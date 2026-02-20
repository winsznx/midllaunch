import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import 'dotenv/config';

// BigInt safe serialization for Redis JSON.stringify calls
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Contract ABIs — must match deployed contract signatures exactly
const LAUNCH_FACTORY_ABI = [
  "event LaunchCreated(address indexed tokenAddress, address indexed curveAddress, address indexed creator, bytes32 intentId, uint256 supplyCap, uint256 basePrice, uint256 priceIncrement, uint8 mode, bytes32 modeMetadata)"
];

const BONDING_CURVE_ABI = [
  "event TokensPurchased(address indexed buyer, bytes32 indexed intentId, uint256 btcAmountSats, uint256 tokenAmountBaseUnits, uint256 newTotalSupply, uint256 newPrice)",
  "function creatorFeeRate() view returns (uint256)"
];

// Environment variables
const RPC_URL = process.env.MIDL_RPC_URL || 'https://rpc.staging.midl.xyz';
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS!;
const START_BLOCK = parseInt(process.env.START_BLOCK || '0');
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '5000');

if (!FACTORY_ADDRESS) {
  throw new Error('FACTORY_ADDRESS not set in .env');
}

class MidlLaunchIndexer {
  private provider: ethers.JsonRpcProvider;
  private factoryContract: ethers.Contract;
  private lastProcessedBlock: bigint;
  private knownCurveAddresses: Set<string> = new Set();
  private readonly curveInterface = new ethers.Interface(BONDING_CURVE_ABI);
  private consecutiveErrors = 0;
  private maxConsecutiveErrors = 10;
  private isCircuitBreakerOpen = false;
  private circuitBreakerResetTime = 0;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

  constructor() {
    console.log(`[Indexer] Connecting to ${RPC_URL}`);
    this.provider = new ethers.JsonRpcProvider(RPC_URL);

    this.factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      LAUNCH_FACTORY_ABI,
      this.provider
    );

    this.lastProcessedBlock = BigInt(START_BLOCK);
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        this.consecutiveErrors = 0; // Reset on success
        return result;
      } catch (error: unknown) {
        const isLastAttempt = attempt === maxRetries;

        if (isLastAttempt) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[Indexer] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Retry failed');
  }

  private checkCircuitBreaker(): boolean {
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      if (!this.isCircuitBreakerOpen) {
        console.error('[Indexer] Circuit breaker OPENED - too many consecutive errors');
        this.isCircuitBreakerOpen = true;
        this.circuitBreakerResetTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT;
      }
      return true;
    }

    // Check if we should try to close the circuit breaker
    if (this.isCircuitBreakerOpen && Date.now() >= this.circuitBreakerResetTime) {
      console.log('[Indexer] Circuit breaker attempting to CLOSE - testing connection');
      this.isCircuitBreakerOpen = false;
      this.consecutiveErrors = 0;
    }

    return this.isCircuitBreakerOpen;
  }

  async initialize() {
    console.log('[Indexer] Initializing...');

    // Get last processed block from database
    const tracking = await prisma.blockTracking.findFirst();
    if (tracking) {
      this.lastProcessedBlock = tracking.lastProcessedBlock;
      console.log(`[Indexer] Resuming from block ${this.lastProcessedBlock}`);
    } else {
      await prisma.blockTracking.create({
        data: { lastProcessedBlock: this.lastProcessedBlock }
      });
      console.log(`[Indexer] Starting from block ${this.lastProcessedBlock}`);
    }

    // Load all known curve addresses into memory
    const existing = await prisma.launch.findMany({ select: { curveAddress: true } });
    existing.forEach(l => this.knownCurveAddresses.add(l.curveAddress));
    console.log(`[Indexer] Loaded ${this.knownCurveAddresses.size} known curve addresses`);

    // Get current block
    const currentBlock = await this.provider.getBlockNumber();
    console.log(`[Indexer] Current block: ${currentBlock}`);
  }

  async processLaunchCreatedEvent(log: ethers.Log) {
    try {
      const decoded = this.factoryContract.interface.parseLog({
        topics: log.topics as string[],
        data: log.data
      });

      if (!decoded) return;

      const { tokenAddress, curveAddress, creator, intentId, supplyCap, basePrice, priceIncrement } = decoded.args;

      console.log(`[LaunchCreated] Token: ${tokenAddress}, Curve: ${curveAddress}`);

      // Get block timestamp
      const block = await this.provider.getBlock(log.blockNumber);
      if (!block) return;

      // Read creatorFeeRate from the deployed bonding curve contract
      const curveContractForFee = new ethers.Contract(
        curveAddress,
        BONDING_CURVE_ABI,
        this.provider
      );
      const creatorFeeRate = parseInt((await curveContractForFee.creatorFeeRate()).toString());

      // Get token metadata (name, symbol) by reading token contract
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function name() view returns (string)', 'function symbol() view returns (string)'],
        this.provider
      );

      const [name, symbol] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol()
      ]);

      // Check for pending IPFS metadata (stored by frontend before tx confirmed)
      const pendingMeta = await prisma.pendingMetadata.findFirst({
        where: { name, symbol, applied: false },
        orderBy: { createdAt: 'desc' },
      });

      // Store in database
      await prisma.launch.create({
        data: {
          id: tokenAddress.toLowerCase(),
          tokenAddress: tokenAddress.toLowerCase(),
          curveAddress: curveAddress.toLowerCase(),
          creator: creator.toLowerCase(),
          intentId,
          name,
          symbol,
          supplyCap: supplyCap.toString(),
          basePrice: basePrice.toString(),
          priceIncrement: priceIncrement.toString(),
          creatorFeeRate,
          status: 'ACTIVE',
          blockNumber: BigInt(log.blockNumber),
          txHash: log.transactionHash || '',
          timestamp: new Date(block.timestamp * 1000),
          ...(pendingMeta ? { metadataUri: `ipfs://${pendingMeta.metadataCID}` } : {}),
        }
      });

      // Mark pending metadata as applied
      if (pendingMeta) {
        await prisma.pendingMetadata.update({
          where: { id: pendingMeta.id },
          data: { applied: true },
        });
        console.log(`[DB] Linked IPFS metadata for: ${name} (${symbol})`);
      }

      this.knownCurveAddresses.add(curveAddress.toLowerCase());
      console.log(`[DB] Stored launch: ${name} (${symbol})`);

      // Broadcast real-time event via Redis
      await redis.publish('launch_created', JSON.stringify({
        tokenAddress: tokenAddress.toLowerCase(),
        curveAddress: curveAddress.toLowerCase(),
        creator: creator.toLowerCase(),
        name,
        symbol,
        timestamp: new Date(block.timestamp * 1000).toISOString()
      }));
    } catch (error) {
      console.error('[LaunchCreated] Error processing event:', error);
    }
  }

  async processTokensPurchasedEvent(log: ethers.Log, curveAddress: string) {
    try {
      const curveContract = new ethers.Contract(
        curveAddress,
        BONDING_CURVE_ABI,
        this.provider
      );

      const decoded = curveContract.interface.parseLog({
        topics: log.topics as string[],
        data: log.data
      });

      if (!decoded) return;

      const { buyer, intentId, btcAmountSats, tokenAmountBaseUnits, newTotalSupply, newPrice } = decoded.args;
      const btcAmount = btcAmountSats;
      const tokenAmount = tokenAmountBaseUnits;

      console.log(`[TokensPurchased] Buyer: ${buyer}, Amount: ${btcAmount.toString()} sats`);

      // Get block timestamp
      const block = await this.provider.getBlock(log.blockNumber);
      if (!block) return;

      // Find launch by curve address
      const launch = await prisma.launch.findUnique({
        where: { curveAddress: curveAddress.toLowerCase() }
      });

      if (!launch) {
        console.error(`[TokensPurchased] Launch not found for curve: ${curveAddress}`);
        return;
      }

      const supplyBefore = newTotalSupply - tokenAmount;

      // Store purchase
      await prisma.purchase.create({
        data: {
          launchId: launch.id,
          buyer: buyer.toLowerCase(),
          intentId,
          btcAmount: btcAmount.toString(),
          tokenAmount: tokenAmount.toString(),
          newSupply: newTotalSupply.toString(),
          newPrice: newPrice.toString(),
          supplyBefore,
          supplyAfter: newTotalSupply,
          blockNumber: BigInt(log.blockNumber),
          txHash: log.transactionHash || '',
          timestamp: new Date(block.timestamp * 1000)
        }
      });

      console.log(`[DB] Stored purchase for launch: ${launch.name}`);

      // Graduation check: finalize if supply cap reached
      if (BigInt(newTotalSupply.toString()) >= BigInt(launch.supplyCap)) {
        await prisma.launch.update({
          where: { id: launch.id },
          data: { status: 'FINALIZED' },
        });
        await redis.publish('launch_finalized', JSON.stringify({
          tokenAddress: launch.tokenAddress,
          launchId: launch.id,
        }));
        console.log(`[DB] Launch FINALIZED: ${launch.name}`);
      }

      // Broadcast real-time events
      await redis.publish('tokens_purchased', JSON.stringify({
        launchId: launch.id,
        tokenAddress: launch.tokenAddress,
        symbol: launch.symbol,
        buyer: buyer.toLowerCase(),
        btcAmount: btcAmount.toString(),
        tokenAmount: tokenAmount.toString(),
        newSupply: newTotalSupply.toString(),
        newPrice: newPrice.toString(),
        timestamp: new Date(block.timestamp * 1000).toISOString()
      }));

      await redis.publish('price_update', JSON.stringify({
        launchId: launch.id,
        tokenAddress: launch.tokenAddress,
        newPrice: newPrice.toString(),
        newSupply: newTotalSupply.toString()
      }));
    } catch (error) {
      console.error('[TokensPurchased] Error processing event:', error);
    }
  }

  async indexBlock(blockNumber: number) {
    if (this.checkCircuitBreaker()) {
      console.log('[Indexer] Circuit breaker OPEN - skipping block indexing');
      return;
    }

    try {
      // Get LaunchCreated events from factory with retry
      const launchLogs = await this.retryWithBackoff(() =>
        this.factoryContract.queryFilter(
          this.factoryContract.filters.LaunchCreated(),
          blockNumber,
          blockNumber
        )
      );

      for (const log of launchLogs) {
        await this.processLaunchCreatedEvent(log as ethers.Log);
      }

      // Batch all TokensPurchased events across all known curves in one RPC call
      const curveAddresses = Array.from(this.knownCurveAddresses);
      if (curveAddresses.length > 0) {
        const purchasedTopic = this.curveInterface.getEvent('TokensPurchased')!.topicHash;

        const purchaseLogs = await this.retryWithBackoff(() =>
          this.provider.getLogs({
            address: curveAddresses,
            topics: [purchasedTopic],
            fromBlock: blockNumber,
            toBlock: blockNumber,
          })
        );

        for (const log of purchaseLogs) {
          await this.processTokensPurchasedEvent(log, log.address.toLowerCase());
        }
      }

      // Update last processed block
      this.lastProcessedBlock = BigInt(blockNumber);
      await prisma.blockTracking.updateMany({
        data: { lastProcessedBlock: this.lastProcessedBlock }
      });

      // Success - reset error counter
      this.consecutiveErrors = 0;

    } catch (error) {
      this.consecutiveErrors++;
      console.error(`[Indexer] Error indexing block ${blockNumber} (${this.consecutiveErrors} consecutive errors):`, error);

      // Don't throw - allow indexer to continue with next block
    }
  }

  async start() {
    console.log('[Indexer] Starting indexing loop...');

    setInterval(async () => {
      try {
        if (this.checkCircuitBreaker()) {
          const waitTime = Math.ceil((this.circuitBreakerResetTime - Date.now()) / 1000);
          console.log(`[Indexer] Circuit breaker OPEN - waiting ${waitTime}s before retry`);
          return;
        }

        const currentBlock = await this.retryWithBackoff(() => this.provider.getBlockNumber());
        const toBlock = BigInt(currentBlock);

        if (this.lastProcessedBlock < toBlock) {
          // Limit blocks per batch to avoid overwhelming the RPC
          const blocksToProcess = Math.min(Number(toBlock - this.lastProcessedBlock), 100);
          const endBlock = this.lastProcessedBlock + BigInt(blocksToProcess);

          console.log(`[Indexer] Processing blocks ${this.lastProcessedBlock + 1n} to ${endBlock} (${blocksToProcess} blocks)`);

          for (let block = this.lastProcessedBlock + 1n; block <= endBlock; block++) {
            await this.indexBlock(Number(block));

            // Small delay between blocks to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } else {
          console.log(`[Indexer] Up to date at block ${this.lastProcessedBlock}`);
        }
      } catch (error) {
        this.consecutiveErrors++;
        console.error(`[Indexer] Error in polling loop (${this.consecutiveErrors} consecutive):`, error);
      }
    }, POLL_INTERVAL);
  }
}

// Start indexer
const indexer = new MidlLaunchIndexer();
indexer.initialize().then(() => {
  indexer.start();
  console.log('[Indexer] Running...');
}).catch(error => {
  console.error('[Indexer] Failed to initialize:', error);
  process.exit(1);
});
