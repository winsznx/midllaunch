import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import 'dotenv/config';

// BigInt safe serialization for Redis JSON.stringify calls
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const prisma = new PrismaClient();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 500, 5000);
    console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
});
redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});
redis.on('connect', () => {
  console.log('[Redis] Connected');
});

async function broadcast(channel: string, payload: Record<string, unknown>) {
  try {
    await redis.publish(channel, JSON.stringify(payload));
  } catch (err) {
    console.error(`[Redis] Failed to publish to ${channel}:`, err);
  }
}

// Contract ABIs — must match deployed contract signatures exactly
const LAUNCH_FACTORY_ABI = [
  "event LaunchCreated(address indexed tokenAddress, address indexed curveAddress, address indexed creator, bytes32 intentId, uint256 supplyCap, uint256 basePrice, uint256 priceIncrement, uint8 mode, bytes32 modeMetadata)"
];

const BONDING_CURVE_ABI = [
  "event TokensPurchased(address indexed buyer, bytes32 indexed intentId, uint256 btcAmountSats, uint256 tokenAmountBaseUnits, uint256 newTotalSupply, uint256 newPrice)",
  "event TokensSold(address indexed seller, bytes32 indexed intentId, uint256 btcAmountSats, uint256 tokenAmountBaseUnits, uint256 newTotalSupply, uint256 newPrice)",
  "function creatorFeeRate() view returns (uint256)"
];

const NFT_FACTORY_ABI = [
  "event CollectionCreated(bytes32 indexed intentId, address indexed creator, address indexed collection, string name, string symbol, uint256 maxSupply, uint256 mintPrice)"
];

const MIDL_NFT_ABI = [
  "event NFTMinted(bytes32 indexed intentId, address indexed buyer, uint256 tokenId, uint256 pricePaid)",
  "function maxPerWallet() view returns (uint256)"
];

// Environment variables
const RPC_URL = process.env.MIDL_RPC_URL || 'https://rpc.staging.midl.xyz';
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS!;
const NFT_FACTORY_ADDRESS = process.env.NFT_FACTORY_ADDRESS || '';
const START_BLOCK = parseInt(process.env.START_BLOCK || '0');
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '5000');

if (!FACTORY_ADDRESS) {
  throw new Error('FACTORY_ADDRESS not set in .env');
}

if (!NFT_FACTORY_ADDRESS) {
  console.warn('[Indexer] NFT_FACTORY_ADDRESS not set — NFT CollectionCreated events will not be indexed');
}

class MidlLaunchIndexer {
  private provider: ethers.JsonRpcProvider;
  private factoryContract: ethers.Contract;
  private nftFactoryContract: ethers.Contract | null = null;
  private lastProcessedBlock: bigint;
  private knownCurveAddresses: Set<string> = new Set();
  private knownCollectionAddresses: Set<string> = new Set();
  private readonly curveInterface = new ethers.Interface(BONDING_CURVE_ABI);
  private readonly nftInterface = new ethers.Interface(MIDL_NFT_ABI);
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

    if (NFT_FACTORY_ADDRESS) {
      this.nftFactoryContract = new ethers.Contract(
        NFT_FACTORY_ADDRESS,
        NFT_FACTORY_ABI,
        this.provider
      );
    }

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

    // Load all known NFT collection addresses into memory
    const existingCollections = await prisma.nftLaunch.findMany({ select: { contractAddress: true } });
    existingCollections.forEach(c => this.knownCollectionAddresses.add(c.contractAddress));
    console.log(`[Indexer] Loaded ${this.knownCollectionAddresses.size} known NFT collections`);

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

      const actualCreator = pendingMeta?.btcAddress || creator.toLowerCase();

      // Store in database with upsert to handle re-syncs gracefully
      await prisma.launch.upsert({
        where: { id: tokenAddress.toLowerCase() },
        update: {
          blockNumber: BigInt(log.blockNumber),
          txHash: log.transactionHash || '',
        },
        create: {
          id: tokenAddress.toLowerCase(),
          tokenAddress: tokenAddress.toLowerCase(),
          curveAddress: curveAddress.toLowerCase(),
          creator: actualCreator,
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
          ...(pendingMeta ? {
            metadataUri: `ipfs://${pendingMeta.metadataCID}`,
            ...(pendingMeta.imageCID ? { imageUrl: `https://gateway.pinata.cloud/ipfs/${pendingMeta.imageCID}` } : {}),
            ...(pendingMeta.description ? { description: pendingMeta.description } : {}),
            ...(pendingMeta.twitterUrl ? { twitterUrl: pendingMeta.twitterUrl } : {}),
            ...(pendingMeta.telegramUrl ? { telegramUrl: pendingMeta.telegramUrl } : {}),
            ...(pendingMeta.websiteUrl ? { websiteUrl: pendingMeta.websiteUrl } : {}),
          } : {})
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

      await broadcast('launch_created', {
        tokenAddress: tokenAddress.toLowerCase(),
        curveAddress: curveAddress.toLowerCase(),
        creator: actualCreator,
        name,
        symbol,
        timestamp: new Date(block.timestamp * 1000).toISOString()
      });
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
      const btcAmount = BigInt(btcAmountSats.toString());
      const tokenAmount = BigInt(tokenAmountBaseUnits.toString());

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

      const supplyAfter = BigInt(newTotalSupply.toString());
      const supplyBefore = supplyAfter - tokenAmount;

      // Check for pending purchase to map EVM Relayer proxy buyer back to L1 BTC user
      const pendingPurchase = await prisma.pendingPurchase.findFirst({
        where: { launchAddr: curveAddress.toLowerCase(), applied: false },
        orderBy: { createdAt: 'desc' },
      });

      const actualBuyer = pendingPurchase ? pendingPurchase.btcAddress : buyer.toLowerCase();

      // Store purchase
      await prisma.purchase.create({
        data: {
          launchId: launch.id,
          buyer: actualBuyer,
          intentId,
          btcAmount: btcAmount.toString(),
          tokenAmount: tokenAmount.toString(),
          newSupply: newTotalSupply.toString(),
          newPrice: newPrice.toString(),
          supplyBefore: supplyBefore.toString(),
          supplyAfter: supplyAfter.toString(),
          blockNumber: BigInt(log.blockNumber),
          txHash: log.transactionHash || '',
          timestamp: new Date(block.timestamp * 1000)
        }
      });

      console.log(`[DB] Stored purchase for launch: ${launch.name}`);

      if (pendingPurchase) {
        await prisma.pendingPurchase.update({
          where: { id: pendingPurchase.id },
          data: { applied: true },
        });
      }

      // Graduation check: finalize if supply cap reached
      if (BigInt(newTotalSupply.toString()) >= BigInt(launch.supplyCap)) {
        await prisma.launch.update({
          where: { id: launch.id },
          data: { status: 'FINALIZED' },
        });
        await broadcast('launch_finalized', {
          tokenAddress: launch.tokenAddress,
          launchId: launch.id,
        });
        console.log(`[DB] Launch FINALIZED: ${launch.name}`);
      }

      await broadcast('tokens_purchased', {
        launchId: launch.id,
        tokenAddress: launch.tokenAddress,
        symbol: launch.symbol,
        buyer: buyer.toLowerCase(),
        btcAmount: btcAmount.toString(),
        tokenAmount: tokenAmount.toString(),
        newSupply: newTotalSupply.toString(),
        newPrice: newPrice.toString(),
        timestamp: new Date(block.timestamp * 1000).toISOString()
      });

      await broadcast('price_update', {
        launchId: launch.id,
        tokenAddress: launch.tokenAddress,
        newPrice: newPrice.toString(),
        newSupply: newTotalSupply.toString()
      });
    } catch (error) {
      console.error('[TokensPurchased] Error processing event:', error);
    }
  }

  async processTokensSoldEvent(log: ethers.Log, curveAddress: string) {
    try {
      const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider);
      const decoded = curveContract.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (!decoded) return;

      const { seller, intentId, btcAmountSats, tokenAmountBaseUnits, newTotalSupply, newPrice } = decoded.args;
      const btcAmount = BigInt(btcAmountSats.toString());
      const tokenAmount = BigInt(tokenAmountBaseUnits.toString());

      console.log(`[TokensSold] Seller: ${seller}, Amount: ${btcAmount.toString()} sats returned`);

      const block = await this.provider.getBlock(log.blockNumber);
      if (!block) return;

      const launch = await prisma.launch.findUnique({
        where: { curveAddress: curveAddress.toLowerCase() }
      });

      if (!launch) {
        console.error(`[TokensSold] Launch not found for curve: ${curveAddress}`);
        return;
      }

      const supplyAfter = BigInt(newTotalSupply.toString());
      const supplyBefore = supplyAfter + tokenAmount;

      // Check for pending purchase to map EVM Relayer proxy buyer back to L1 BTC user
      const pendingPurchase = await prisma.pendingPurchase.findFirst({
        where: { launchAddr: curveAddress.toLowerCase(), applied: false },
        orderBy: { createdAt: 'desc' },
      });

      const actualSeller = pendingPurchase ? pendingPurchase.btcAddress : seller.toLowerCase();

      await prisma.purchase.create({
        data: {
          launchId: launch.id,
          tradeType: 'SELL',
          buyer: actualSeller,
          intentId,
          btcAmount: btcAmountSats.toString(),
          tokenAmount: tokenAmountBaseUnits.toString(),
          newSupply: newTotalSupply.toString(),
          newPrice: newPrice.toString(),
          supplyBefore: supplyBefore.toString(),
          supplyAfter: supplyAfter.toString(),
          blockNumber: BigInt(log.blockNumber),
          txHash: log.transactionHash || '',
          timestamp: new Date(block.timestamp * 1000),
        },
      });

      console.log(`[DB] Stored sell for launch: ${launch.name}`);

      if (pendingPurchase) {
        await prisma.pendingPurchase.update({
          where: { id: pendingPurchase.id },
          data: { applied: true },
        });
      }

      await broadcast('tokens_sold', {
        launchId: launch.id,
        tokenAddress: launch.tokenAddress,
        symbol: launch.symbol,
        seller: seller.toLowerCase(),
        btcAmount: btcAmountSats.toString(),
        tokenAmount: tokenAmountBaseUnits.toString(),
        newSupply: newTotalSupply.toString(),
        newPrice: newPrice.toString(),
        timestamp: new Date(block.timestamp * 1000).toISOString(),
      });

      await broadcast('price_update', {
        launchId: launch.id,
        tokenAddress: launch.tokenAddress,
        newPrice: newPrice.toString(),
        newSupply: newTotalSupply.toString(),
      });
    } catch (error) {
      console.error('[TokensSold] Error processing event:', error);
    }
  }

  async processCollectionCreatedEvent(log: ethers.Log) {
    try {
      const decoded = this.nftFactoryContract!.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (!decoded) return;

      const { intentId, creator, collection, name, symbol, maxSupply, mintPrice } = decoded.args;
      const contractAddress = (collection as string).toLowerCase();

      console.log(`[CollectionCreated] Collection: ${contractAddress}, Name: ${name}`);

      const block = await this.provider.getBlock(log.blockNumber);
      if (!block) return;

      // Read maxPerWallet directly from the deployed collection contract
      const collectionContract = new ethers.Contract(contractAddress, MIDL_NFT_ABI, this.provider);
      const maxPerWallet = Number(await collectionContract.maxPerWallet());

      // Check for pending IPFS metadata (stored by frontend before tx confirmed)
      const pendingMeta = await prisma.pendingMetadata.findFirst({
        where: { name, symbol, applied: false },
        orderBy: { createdAt: 'desc' },
      });

      const actualCreator = pendingMeta?.btcAddress || (creator as string).toLowerCase();

      await prisma.nftLaunch.upsert({
        where: { contractAddress },
        update: {
          createdAt: new Date(block.timestamp * 1000),
        },
        create: {
          contractAddress,
          name,
          symbol,
          totalSupply: Number(maxSupply),
          mintPrice: BigInt(mintPrice.toString()),
          maxPerWallet,
          creatorAddress: actualCreator,
          ...(pendingMeta ? {
            metadataCID: pendingMeta.metadataCID,
            ...(pendingMeta.imageCID ? { imageUrl: `https://gateway.pinata.cloud/ipfs/${pendingMeta.imageCID}` } : {}),
            ...(pendingMeta.description ? { description: pendingMeta.description } : {}),
            ...(pendingMeta.twitterUrl ? { twitterUrl: pendingMeta.twitterUrl } : {}),
            ...(pendingMeta.telegramUrl ? { telegramUrl: pendingMeta.telegramUrl } : {}),
            ...(pendingMeta.websiteUrl ? { websiteUrl: pendingMeta.websiteUrl } : {}),
          } : {}),
        },
      });

      if (pendingMeta) {
        await prisma.pendingMetadata.update({
          where: { id: pendingMeta.id },
          data: { applied: true },
        });
        console.log(`[DB] Linked IPFS metadata for NFT: ${name} (${symbol})`);
      }

      this.knownCollectionAddresses.add(contractAddress);
      console.log(`[DB] Stored NFT collection: ${name} (${symbol}) at ${contractAddress}`);

      await broadcast('nft_collection_created', {
        contractAddress,
        creator: actualCreator,
        name,
        symbol,
        maxSupply: maxSupply.toString(),
        mintPrice: mintPrice.toString(),
        timestamp: new Date(block.timestamp * 1000).toISOString(),
      });
    } catch (error) {
      console.error('[CollectionCreated] Error processing event:', error);
    }
  }

  async processNFTMintedEvent(log: ethers.Log) {
    try {
      const collectionAddress = log.address.toLowerCase();
      const nftContract = new ethers.Contract(collectionAddress, MIDL_NFT_ABI, this.provider);
      const decoded = nftContract.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (!decoded) return;

      const { intentId, buyer, tokenId, pricePaid } = decoded.args;

      console.log(`[NFTMinted] Collection: ${collectionAddress}, Token: ${tokenId}, Buyer: ${buyer}`);

      const block = await this.provider.getBlock(log.blockNumber);
      if (!block) return;

      const nftLaunch = await prisma.nftLaunch.findUnique({
        where: { contractAddress: collectionAddress },
      });

      if (!nftLaunch) {
        console.error(`[NFTMinted] NftLaunch not found for collection: ${collectionAddress}`);
        return;
      }

      await prisma.nftMint.create({
        data: {
          launchId: nftLaunch.id,
          tokenId: Number(tokenId),
          buyerAddress: (buyer as string).toLowerCase(),
          pricePaidSats: BigInt(pricePaid.toString()),
          txHash: log.transactionHash || '',
          createdAt: new Date(block.timestamp * 1000),
        },
      });

      await prisma.nftLaunch.update({
        where: { id: nftLaunch.id },
        data: { totalMinted: { increment: 1 } },
      });

      console.log(`[DB] Stored NFT mint: ${nftLaunch.name} #${tokenId}`);

      await broadcast('nft_minted', {
        contractAddress: collectionAddress,
        launchId: nftLaunch.id,
        name: nftLaunch.name,
        symbol: nftLaunch.symbol,
        buyer: (buyer as string).toLowerCase(),
        tokenId: tokenId.toString(),
        pricePaid: pricePaid.toString(),
        timestamp: new Date(block.timestamp * 1000).toISOString(),
      });
    } catch (error) {
      console.error('[NFTMinted] Error processing event:', error);
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

      // Batch TokensPurchased and TokensSold across all known curves in one RPC call each
      const curveAddresses = Array.from(this.knownCurveAddresses);
      if (curveAddresses.length > 0) {
        const purchasedTopic = this.curveInterface.getEvent('TokensPurchased')!.topicHash;
        const soldTopic = this.curveInterface.getEvent('TokensSold')!.topicHash;

        const [purchaseLogs, sellLogs] = await Promise.all([
          this.retryWithBackoff(() =>
            this.provider.getLogs({
              address: curveAddresses,
              topics: [purchasedTopic],
              fromBlock: blockNumber,
              toBlock: blockNumber,
            })
          ),
          this.retryWithBackoff(() =>
            this.provider.getLogs({
              address: curveAddresses,
              topics: [soldTopic],
              fromBlock: blockNumber,
              toBlock: blockNumber,
            })
          ),
        ]);

        for (const log of purchaseLogs) {
          await this.processTokensPurchasedEvent(log, log.address.toLowerCase());
        }
        for (const log of sellLogs) {
          await this.processTokensSoldEvent(log, log.address.toLowerCase());
        }
      }

      // NFT CollectionCreated events from factory
      if (this.nftFactoryContract) {
        const collectionLogs = await this.retryWithBackoff(() =>
          this.nftFactoryContract!.queryFilter(
            this.nftFactoryContract!.filters.CollectionCreated(),
            blockNumber,
            blockNumber
          )
        );
        for (const log of collectionLogs) {
          await this.processCollectionCreatedEvent(log as ethers.Log);
        }
      }

      // NFT mint events across all known collections
      const collectionAddresses = Array.from(this.knownCollectionAddresses);
      if (collectionAddresses.length > 0) {
        const mintedTopic = this.nftInterface.getEvent('NFTMinted')!.topicHash;
        const mintLogs = await this.retryWithBackoff(() =>
          this.provider.getLogs({
            address: collectionAddresses,
            topics: [mintedTopic],
            fromBlock: blockNumber,
            toBlock: blockNumber,
          })
        );
        for (const log of mintLogs) {
          await this.processNFTMintedEvent(log);
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
