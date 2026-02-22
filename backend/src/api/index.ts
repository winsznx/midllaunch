import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { PrismaClient, Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { z } from 'zod';
import 'dotenv/config';

// Prisma returns BigInt for blockNumber fields — patch for JSON serialization
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const app = express();
app.set('trust proxy', 1);
const prisma = new PrismaClient();

// Redis for WS broadcasts — graceful degradation if unavailable
let redis: Redis | null = null;
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { lazyConnect: true });
  redis.on('error', () => { /* suppress — WS broadcast is non-critical */ });
} catch {
  redis = null;
}

async function broadcast(channel: string, payload: Record<string, unknown>) {
  if (!redis) return;
  try { await redis.publish(channel, JSON.stringify(payload)); } catch { /* non-critical */ }
}

async function getCached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached) as T;
    } catch { /* cache read failure — fall through to DB */ }
  }
  const result = await fn();
  if (redis) {
    try { await redis.setex(key, ttlSeconds, JSON.stringify(result)); } catch { /* non-critical */ }
  }
  return result;
}

async function invalidateCache(...keys: string[]) {
  if (!redis) return;
  try { await redis.del(...keys); } catch { /* non-critical */ }
}

function parseIntParam(value: unknown, defaultValue: number): number {
  const n = parseInt(value as string, 10);
  return Number.isFinite(n) && n >= 0 ? n : defaultValue;
}

const PORT = process.env.PORT || 4000;
const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3002')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const readLimiter = rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

// Middleware
app.use(cors({ origin: CORS_ORIGINS.length === 1 ? CORS_ORIGINS[0] : CORS_ORIGINS }));
app.use(express.json());
app.use('/api', readLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/launches - List all launches with filtering and sorting
app.get('/api/launches', async (req, res) => {
  try {
    const { status, sortBy = 'newest', limit = '20', offset = '0' } = req.query;
    const cacheKey = `launches:${status ?? 'all'}:${sortBy}:${limit}:${offset}`;

    const payload = await getCached(cacheKey, 5, async () => {
      const where: Prisma.LaunchWhereInput = {};
      if (status === 'ACTIVE') where.status = 'ACTIVE';
      if (status === 'FINALIZED') where.status = 'FINALIZED';

      let orderBy: Prisma.LaunchOrderByWithRelationInput = { timestamp: 'desc' }; // newest first

      if (sortBy === 'price_low') orderBy = { basePrice: 'asc' };
      if (sortBy === 'price_high') orderBy = { basePrice: 'desc' };

      // Trending and near_cap both require fetching all, sorting in memory, then paginating
      const isTrending = sortBy === 'trending';
      const isNearCap = sortBy === 'near_cap';
      const fetchAll = isTrending || isNearCap;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const launches = await prisma.launch.findMany({
        where,
        orderBy: fetchAll ? undefined : orderBy,
        take: fetchAll ? undefined : parseIntParam(limit, 20),
        skip: fetchAll ? undefined : parseIntParam(offset, 0),
        include: {
          _count: {
            select: { purchases: true }
          },
          // Always fetch latest purchase for current state (newSupply, newPrice).
          // For trending we also need btcAmount + timestamp for scoring; no take limit
          // so all purchases are available for 1h filtering in memory.
          purchases: {
            orderBy: { timestamp: 'desc' as const },
            ...(isTrending ? {} : { take: 1 }),

          },
        }
      });

      // For trending: score = (btcVolume_1h × 0.4) + (buyers_1h × 0.3) + (recency × 0.3)
      // Then sort + paginate in memory
      let result = launches;
      if (isTrending) {
        const now = Date.now();
        const scored = launches.map(l => {
          const allPurchases = Array.isArray(l.purchases) ? l.purchases : [];
          const recentPurchases = allPurchases.filter(
            p => new Date(p.timestamp).getTime() >= oneHourAgo.getTime()
          );
          const volume1h = recentPurchases.reduce((s, p) => s + Number(p.btcAmount), 0);
          const buyers1h = recentPurchases.length;
          const ageMs = now - new Date(l.timestamp).getTime();
          const recencyScore = Math.max(0, 1 - ageMs / (7 * 24 * 60 * 60 * 1000)); // decay over 7d
          const score = volume1h * 0.4 + buyers1h * 0.3 + recencyScore * 0.3;
          return { ...l, _trendScore: score };
        });
        scored.sort((a, b) => b._trendScore - a._trendScore);
        const skip = parseIntParam(offset, 0);
        const take = parseIntParam(limit, 20);
        result = scored.slice(skip, skip + take) as typeof launches;
      } else if (isNearCap) {
        // Sort by fill ratio (currentSupply / supplyCap) descending — BigInt to avoid float loss
        const withRatio = launches.map(l => {
          const supply = BigInt(l.purchases[0]?.newSupply ?? '0');
          const cap = BigInt(l.supplyCap);
          const ratioBP = cap > BigInt(0) ? (supply * BigInt(10_000)) / cap : BigInt(0);
          return { ...l, _fillRatioBP: ratioBP };
        });
        withRatio.sort((a, b) => Number(b._fillRatioBP - a._fillRatioBP));
        const skip = parseIntParam(offset, 0);
        const take = parseIntParam(limit, 20);
        result = withRatio.slice(skip, skip + take) as typeof launches;
      }

      // Extract current state from latest purchase (first entry — desc order)
      const launchesWithProgress = result.map(launch => {
        const latestPurchase = Array.isArray(launch.purchases) ? launch.purchases[0] : undefined;
        const currentSupply = latestPurchase?.newSupply ?? '0';
        const currentPrice = latestPurchase?.newPrice ?? launch.basePrice;
        return {
          ...launch,
          purchases: undefined, // don't leak purchase list in collection endpoint
          purchaseCount: launch._count.purchases,
          currentSupply,
          currentPrice,
          progress: calculateProgress(currentSupply, launch.supplyCap),
        };
      });

      return {
        launches: launchesWithProgress,
        total: await prisma.launch.count({ where }),
      };
    }); // end getCached

    res.json(payload);
  } catch (error) {
    console.error('[API] Error fetching launches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/launches/search - Search by name or symbol
app.get('/api/launches/search', async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') return res.json({ launches: [] });
  try {
    const launches = await prisma.launch.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { symbol: { contains: q } },
        ],
      },
      take: 20,
      orderBy: { timestamp: 'desc' },
    });
    res.json({ launches });
  } catch (error) {
    console.error('[API] Error searching launches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/launches/graduating - Launches where supply >= 70% of cap
app.get('/api/launches/graduating', async (req, res) => {
  try {
    const launches = await prisma.launch.findMany({
      where: { status: 'ACTIVE' },
      include: {
        purchases: {
          orderBy: { timestamp: 'desc' as const },
          take: 1,

        },
      },
    });
    const graduating = launches
      .filter(l => {
        const supply = BigInt(l.purchases[0]?.newSupply ?? '0');
        const cap = BigInt(l.supplyCap);
        return cap > BigInt(0) && supply * BigInt(100) >= cap * BigInt(70);
      })
      .map(l => ({
        ...l,
        currentSupply: l.purchases[0]?.newSupply ?? '0',
        currentPrice: l.purchases[0]?.newPrice ?? l.basePrice,
        purchases: undefined,
        progress: calculateProgress(l.purchases[0]?.newSupply ?? '0', l.supplyCap),
      }));
    res.json({ launches: graduating });
  } catch (error) {
    console.error('[API] Error fetching graduating:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/activity - Global activity feed (last 50 purchases)
app.get('/api/activity', async (req, res) => {
  try {
    const events = await getCached('activity:global', 10, async () => {
      const purchases = await prisma.purchase.findMany({
        orderBy: { timestamp: 'desc' },
        take: 50,
        include: {
          launch: true,
        },
      });
      return purchases.map(p => ({
        type: 'purchase' as const,
        launchAddress: p.launch.tokenAddress,
        tokenName: p.launch.name,
        tokenSymbol: p.launch.symbol,
        buyerAddress: p.buyer,
        amountSats: p.btcAmount,
        tokensReceived: p.tokenAmount,
        txHash: p.txHash,
        createdAt: p.timestamp,
      }));
    });
    res.json({ events });
  } catch (error) {
    console.error('[API] Error fetching activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Zod schemas for metadata validation
const metadataSchema = z.object({
  metadataCID: z.string().optional(),
  imageUrl: z.string().url().optional(),
  description: z.string().max(1000).optional(),
  twitterUrl: z.string().url().optional(),
  telegramUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
}).strict();

// PATCH /api/launches/:tokenAddress/metadata - Update off-chain metadata
app.patch('/api/launches/:tokenAddress/metadata', writeLimiter, async (req, res) => {
  const tokenAddress = String(req.params.tokenAddress);
  if (!tokenAddress) return res.status(400).json({ error: 'tokenAddress required' });
  const parsed = metadataSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
  }
  try {
    const { metadataCID, imageUrl, description, twitterUrl, telegramUrl, websiteUrl } = parsed.data;
    const launch = await prisma.launch.update({
      where: { tokenAddress: tokenAddress.toLowerCase() },
      data: {
        ...(metadataCID !== undefined && { metadataCID }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(description !== undefined && { description }),
        ...(twitterUrl !== undefined && { twitterUrl }),
        ...(telegramUrl !== undefined && { telegramUrl }),
        ...(websiteUrl !== undefined && { websiteUrl }),
      },
    });
    await invalidateCache(`launch:${tokenAddress.toLowerCase()}`);
    res.json({ launch });
  } catch {
    res.status(404).json({ error: 'Launch not found' });
  }
});

// GET /api/nft-launches - List NFT launches
app.get('/api/nft-launches', async (req, res) => {
  try {
    const { limit = '20', offset = '0', sortBy = 'newest' } = req.query;
    const orderBy = sortBy === 'market_cap'
      ? { mintPrice: 'desc' as const }
      : { createdAt: 'desc' as const };
    const [launches, total] = await Promise.all([
      prisma.nftLaunch.findMany({
        orderBy,
        take: parseIntParam(limit, 20),
        skip: parseIntParam(offset, 0),
      }),
      prisma.nftLaunch.count(),
    ]);
    res.json({ launches, total });
  } catch (error) {
    console.error('[API] Error fetching NFT launches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/nft-launches/:address - Single NFT launch
app.get('/api/nft-launches/:address', async (req, res) => {
  try {
    const launch = await prisma.nftLaunch.findUnique({
      where: { contractAddress: req.params.address.toLowerCase() },
      include: { mints: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!launch) return res.status(404).json({ error: 'NFT launch not found' });
    res.json(launch);
  } catch (error) {
    console.error('[API] Error fetching NFT launch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/nft-launches/:address/mints - Mint history
app.get('/api/nft-launches/:address/mints', async (req, res) => {
  try {
    const { limit = '20', offset = '0' } = req.query;
    const launch = await prisma.nftLaunch.findUnique({
      where: { contractAddress: req.params.address.toLowerCase() },
      select: { id: true },
    });
    if (!launch) return res.status(404).json({ error: 'NFT launch not found' });
    const [mints, total] = await Promise.all([
      prisma.nftMint.findMany({
        where: { launchId: launch.id },
        orderBy: { createdAt: 'desc' },
        take: parseIntParam(limit, 20),
        skip: parseIntParam(offset, 0),
      }),
      prisma.nftMint.count({ where: { launchId: launch.id } }),
    ]);
    res.json({ mints, total });
  } catch (error) {
    console.error('[API] Error fetching mints:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/nft-launches/:address/metadata
app.patch('/api/nft-launches/:address/metadata', writeLimiter, async (req, res) => {
  const addr = String(req.params.address).toLowerCase();
  const parsed = metadataSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
  }
  try {
    const { metadataCID, imageUrl, description, twitterUrl, telegramUrl, websiteUrl } = parsed.data;
    const launch = await prisma.nftLaunch.update({
      where: { contractAddress: addr },
      data: {
        ...(metadataCID !== undefined && { metadataCID }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(description !== undefined && { description }),
        ...(twitterUrl !== undefined && { twitterUrl }),
        ...(telegramUrl !== undefined && { telegramUrl }),
        ...(websiteUrl !== undefined && { websiteUrl }),
      },
    });
    res.json({ launch });
  } catch {
    res.status(404).json({ error: 'NFT launch not found' });
  }
});

// GET /api/launches/:tokenAddress - Get launch details
app.get('/api/launches/:tokenAddress', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const addr = tokenAddress.toLowerCase();

    const payload = await getCached(`launch:${addr}`, 10, async () => {
      const launch = await prisma.launch.findUnique({
        where: { tokenAddress: addr },
        include: {
          purchases: {
            orderBy: { timestamp: 'desc' },
            take: 10
          }
        }
      });

      if (!launch) return null;

      let currentSupply = '0';
      let currentPrice = launch.basePrice;

      if (launch.purchases.length > 0) {
        currentSupply = launch.purchases[0].newSupply;
        currentPrice = launch.purchases[0].newPrice;
      }

      const allPurchases = await prisma.purchase.findMany({
        where: { launchId: launch.id },
        select: { btcAmount: true },
      });
      const totalBTCDeposited = allPurchases
        .reduce((acc, p) => acc + BigInt(p.btcAmount), BigInt(0))
        .toString();

      return {
        ...launch,
        currentSupply,
        currentPrice,
        totalBTCDeposited,
        progress: calculateProgress(currentSupply, launch.supplyCap),
      };
    });

    if (!payload) return res.status(404).json({ error: 'Launch not found' });
    res.json(payload);
  } catch (error) {
    console.error('[API] Error fetching launch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/launches/:tokenAddress/purchases - Get purchase history
app.get('/api/launches/:tokenAddress/purchases', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const launch = await prisma.launch.findUnique({
      where: { tokenAddress: tokenAddress.toLowerCase() }
    });

    if (!launch) {
      return res.status(404).json({ error: 'Launch not found' });
    }

    const purchases = await prisma.purchase.findMany({
      where: { launchId: launch.id },
      orderBy: { timestamp: 'desc' },
      take: parseIntParam(limit, 20),
      skip: parseIntParam(offset, 0)
    });

    const total = await prisma.purchase.count({
      where: { launchId: launch.id }
    });

    res.json({
      purchases,
      total
    });
  } catch (error) {
    console.error('[API] Error fetching purchases:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/launches/:tokenAddress/chart - OHLC candle data
app.get('/api/launches/:tokenAddress/chart', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const interval = (req.query.interval as string) || '1h';

    const intervalMs: Record<string, number> = {
      '5m': 5 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };

    const bucketMs = intervalMs[interval] ?? intervalMs['1h'];

    const launch = await prisma.launch.findUnique({
      where: { tokenAddress: tokenAddress.toLowerCase() },
    });
    if (!launch) return res.status(404).json({ error: 'Launch not found' });

    const purchases = await prisma.purchase.findMany({
      where: { launchId: launch.id },
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true, supplyBefore: true, supplyAfter: true, newSupply: true, btcAmount: true },
    });

    if (purchases.length === 0) return res.json({ candles: [], interval });

    const basePrice = Number(launch.basePrice);
    const priceIncrement = Number(launch.priceIncrement);

    // Price at a given supply (supply in base units → divide by 1e18 for whole tokens)
    const TOKEN_BASE = 1e18;
    const priceAt = (supplyBaseUnits: number) =>
      basePrice + (supplyBaseUnits / TOKEN_BASE) * priceIncrement;

    const buckets = new Map<number, typeof purchases>();
    for (const p of purchases) {
      const ts = Math.floor(p.timestamp.getTime() / bucketMs) * bucketMs;
      if (!buckets.has(ts)) buckets.set(ts, []);
      buckets.get(ts)!.push(p);
    }

    const candles = Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([ts, txs]) => {
        const supplyAfterVals = txs.map(t => Number(t.supplyAfter ?? t.newSupply ?? 0));
        const open = priceAt(Number(txs[0].supplyBefore ?? 0));
        const close = priceAt(supplyAfterVals[supplyAfterVals.length - 1]);
        const high = Math.max(...supplyAfterVals.map(s => priceAt(s)));
        const low = Math.min(open, close);
        const volume = txs.reduce((sum, t) => sum + Number(t.btcAmount), 0);
        return { time: ts, open, high, low, close, volume };
      });

    res.json({ candles, interval });
  } catch (error) {
    console.error('[API] Error fetching chart data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/:address/holdings - Get user token holdings
app.get('/api/user/:address/holdings', async (req, res) => {
  try {
    const { address } = req.params;

    const purchases = await prisma.purchase.findMany({
      where: { buyer: address.toLowerCase() },
      include: {
        launch: {
          select: {
            name: true,
            symbol: true,
            tokenAddress: true,
            basePrice: true,
            priceIncrement: true,
            purchases: {
              orderBy: { timestamp: 'desc' as const },
              take: 1,

            },
          }
        },
      },
    });

    interface HoldingAccumulator {
      launch: (typeof purchases)[number]['launch'];
      totalTokens: bigint;
      totalBTCSpent: bigint;
      purchaseCount: number;
    }

    const holdingsMap = new Map<string, HoldingAccumulator>();
    purchases.forEach(purchase => {
      const launchId = purchase.launchId;
      if (!holdingsMap.has(launchId)) {
        holdingsMap.set(launchId, {
          launch: purchase.launch,
          totalTokens: BigInt(0),
          totalBTCSpent: BigInt(0),
          purchaseCount: 0,
        });
      }
      const holding = holdingsMap.get(launchId)!;
      if (purchase.tradeType === 'SELL') {
        holding.totalTokens -= BigInt(purchase.tokenAmount);
        holding.totalBTCSpent -= BigInt(purchase.btcAmount);
      } else {
        holding.totalTokens += BigInt(purchase.tokenAmount);
        holding.totalBTCSpent += BigInt(purchase.btcAmount);
      }
      holding.purchaseCount += 1;
    });

    const holdings = Array.from(holdingsMap.values()).filter(h => h.totalTokens > BigInt(0)).map(h => {
      const latestPurchase = h.launch.purchases[0];
      const currentPriceSats = Number(latestPurchase?.newPrice ?? h.launch.basePrice);
      const totalTokens = h.totalTokens;
      const totalInvested = h.totalBTCSpent;
      const avgBuyPriceSats = totalTokens > BigInt(0)
        ? Number((totalInvested * BigInt('1000000000000000000')) / totalTokens)
        : 0;
      const currentValueSats = Number((totalTokens * BigInt(currentPriceSats)) / BigInt(1000000000000000000));
      const unrealizedPnlSats = currentValueSats - Number(totalInvested);
      const unrealizedPnlPct = Number(totalInvested) > 0
        ? (unrealizedPnlSats / Number(totalInvested)) * 100
        : 0;
      return {
        tokenAddress: h.launch.tokenAddress,
        tokenName: h.launch.name,
        tokenSymbol: h.launch.symbol,
        balance: totalTokens.toString(),
        totalInvested: totalInvested.toString(),
        purchaseCount: h.purchaseCount,
        avgBuyPriceSats: Math.round(avgBuyPriceSats),
        currentPriceSats,
        unrealizedPnlSats: Math.round(unrealizedPnlSats),
        unrealizedPnlPct: Math.round(unrealizedPnlPct * 100) / 100,
      };
    });

    res.json({ holdings });
  } catch (error) {
    console.error('[API] Error fetching user holdings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/:address/activity - Get user activity history
app.get('/api/user/:address/activity', async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const addr = address.toLowerCase();

    const [purchases, launches, nftLaunches, nftMints] = await Promise.all([
      prisma.purchase.findMany({
        where: { buyer: addr },
        orderBy: { timestamp: 'desc' },
        take: parseIntParam(limit, 50),
        skip: parseIntParam(offset, 0),
        include: {
          launch: {
            select: { name: true, symbol: true, tokenAddress: true }
          }
        }
      }),
      prisma.launch.findMany({
        where: { creator: addr },
        orderBy: { timestamp: 'desc' },
        select: {
          tokenAddress: true,
          name: true,
          symbol: true,
          intentId: true,
          txHash: true,
          timestamp: true,
          imageUrl: true,
        }
      }),
      prisma.nftLaunch.findMany({
        where: { creatorAddress: addr },
        orderBy: { createdAt: 'desc' },
        select: {
          contractAddress: true,
          name: true,
          symbol: true,
          createdAt: true,
          imageUrl: true,
        }
      }),
      prisma.nftMint.findMany({
        where: { buyerAddress: addr },
        orderBy: { createdAt: 'desc' },
        include: {
          launch: {
            select: { contractAddress: true, name: true, symbol: true, imageUrl: true }
          }
        }
      }),
    ]);

    const total = await prisma.purchase.count({ where: { buyer: addr } });

    res.json({ purchases, launches, nftLaunches, nftMints, total });
  } catch (error) {
    console.error('[API] Error fetching user activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stats - Get global statistics
app.get('/api/stats', async (req, res) => {
  try {
    const payload = await getCached('stats', 30, async () => {
      const [totalLaunches, activeLaunches, finalizedLaunches, totalNFTLaunches] = await Promise.all([
        prisma.launch.count(),
        prisma.launch.count({ where: { status: 'ACTIVE' } }),
        prisma.launch.count({ where: { status: 'FINALIZED' } }),
        prisma.nftLaunch.count(),
      ]);

      const purchases = await prisma.purchase.findMany({ select: { btcAmount: true, buyer: true } });
      const totalBTCDeposited = purchases.reduce((sum, p) => sum + BigInt(p.btcAmount), BigInt(0));
      const uniqueBuyers = new Set(purchases.map(p => p.buyer)).size;

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [purchases24h, uniqueCreatorsResult] = await Promise.all([
        prisma.purchase.count({ where: { timestamp: { gte: yesterday } } }),
        prisma.launch.findMany({ select: { creator: true }, distinct: ['creator'] }),
      ]);

      return {
        totalLaunches,
        activeLaunches,
        finalizedLaunches,
        totalNFTLaunches,
        totalBTCDeposited: totalBTCDeposited.toString(),
        purchases24h,
        uniqueCreators: uniqueCreatorsResult.length,
        uniqueBuyers,
      };
    });

    res.json(payload);
  } catch (error) {
    console.error('[API] Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/launches/:tokenAddress/comments - Get comments for a launch
app.get('/api/launches/:tokenAddress/comments', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const launch = await prisma.launch.findUnique({
      where: { tokenAddress: tokenAddress.toLowerCase() },
      select: { id: true },
    });

    if (!launch) return res.status(404).json({ error: 'Launch not found' });

    const comments = await prisma.comment.findMany({
      where: { launchId: launch.id },
      orderBy: { timestamp: 'asc' },
      take: parseIntParam(limit, 20),
      skip: parseIntParam(offset, 0),
    });

    const total = await prisma.comment.count({ where: { launchId: launch.id } });

    res.json({ comments, total });
  } catch (error) {
    console.error('[API] Error fetching comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/pending-metadata - Store IPFS metadata CID before tx confirms
app.post('/api/pending-metadata', async (req, res) => {
  try {
    const { btcTxId, metadataCID, imageCID, name, symbol, description, twitterUrl, telegramUrl, websiteUrl } = req.body as {
      btcTxId?: string;
      metadataCID?: string;
      imageCID?: string;
      name?: string;
      symbol?: string;
      description?: string;
      twitterUrl?: string;
      telegramUrl?: string;
      websiteUrl?: string;
    };

    if (!btcTxId || !metadataCID || !name || !symbol) {
      return res.status(400).json({ error: 'btcTxId, metadataCID, name, symbol required' });
    }

    await prisma.pendingMetadata.create({
      data: {
        btcTxId, metadataCID, name, symbol,
        ...(imageCID ? { imageCID } : {}),
        ...(description ? { description } : {}),
        ...(twitterUrl ? { twitterUrl } : {}),
        ...(telegramUrl ? { telegramUrl } : {}),
        ...(websiteUrl ? { websiteUrl } : {}),
      },
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('[API] Error storing pending metadata:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/launches/:tokenAddress/comments - Post a new comment
app.post('/api/launches/:tokenAddress/comments', async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    const { author, body } = req.body as { author?: string; body?: string };

    if (!author || typeof author !== 'string' || author.length < 10) {
      return res.status(400).json({ error: 'Invalid author address' });
    }
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({ error: 'Comment body required' });
    }
    const trimmed = body.trim().slice(0, 500);

    const launch = await prisma.launch.findUnique({
      where: { tokenAddress: tokenAddress.toLowerCase() },
      select: { id: true },
    });

    if (!launch) return res.status(404).json({ error: 'Launch not found' });

    const comment = await prisma.comment.create({
      data: { launchId: launch.id, author, body: trimmed },
    });

    await broadcast('comment_posted', {
      tokenAddress: tokenAddress.toLowerCase(),
      comment: { id: comment.id, launchId: comment.launchId, author: comment.author, body: comment.body, timestamp: comment.timestamp },
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error('[API] Error posting comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/launches/trending - Top 10 launches by scoring algorithm (dedicated, 60s TTL)
// NOTE: must stay after /search and /graduating (also before /:tokenAddress wildcard) — already satisfied by position
app.get('/api/launches/trending', async (req, res) => {
  try {
    const payload = await getCached('launches:trending:top10', 60, async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const launches = await prisma.launch.findMany({
        where: { status: 'ACTIVE' },
        include: {
          purchases: {
            select: { btcAmount: true, buyer: true, timestamp: true, newSupply: true, newPrice: true },
          },
        },
      });
      const now = Date.now();
      const scored = launches.map(l => {
        const recentPurchases = l.purchases.filter(
          p => new Date(p.timestamp).getTime() >= oneHourAgo.getTime()
        );
        const volume1h = recentPurchases.reduce((s, p) => s + Number(p.btcAmount), 0);
        const uniqueBuyers1h = new Set(recentPurchases.map(p => p.buyer)).size;
        const ageMs = now - new Date(l.timestamp).getTime();
        const recencyScore = Math.max(0, 1 - ageMs / (7 * 24 * 60 * 60 * 1000));
        const score = volume1h * 0.4 + uniqueBuyers1h * 0.3e8 + recencyScore * 0.3e8;
        const latestPurchase = l.purchases
          .slice()
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        return {
          ...l,
          purchases: undefined,
          purchaseCount: l.purchases.length,
          currentSupply: latestPurchase?.newSupply ?? '0',
          currentPrice: latestPurchase?.newPrice ?? l.basePrice,
          progress: calculateProgress(latestPurchase?.newSupply ?? '0', l.supplyCap),
          _score: score,
        };
      });
      scored.sort((a, b) => b._score - a._score);
      return scored.slice(0, 10).map(({ _score: _, ...rest }) => rest);
    });
    res.json({ launches: payload });
  } catch (error) {
    console.error('[API] Error fetching trending:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/launches/:tokenAddress/price-history - Price history derived from purchases
app.get('/api/launches/:tokenAddress/price-history', async (req, res) => {
  try {
    const addr = req.params.tokenAddress.toLowerCase();
    const launch = await prisma.launch.findUnique({
      where: { tokenAddress: addr },
      select: { id: true, basePrice: true, timestamp: true },
    });
    if (!launch) return res.status(404).json({ error: 'Launch not found' });

    const purchases = await prisma.purchase.findMany({
      where: { launchId: launch.id },
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true, newSupply: true, newPrice: true },
    });

    const history = [
      { timestamp: new Date(launch.timestamp).getTime(), price: launch.basePrice, supply: '0' },
      ...purchases.map(p => ({
        timestamp: new Date(p.timestamp).getTime(),
        price: p.newPrice,
        supply: p.newSupply,
      })),
    ];
    res.json({ history });
  } catch (error) {
    console.error('[API] Error fetching price history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/nft-launches/:address/mints - Record a new mint and broadcast
const mintSchema = z.object({
  tokenId: z.number().int().nonnegative(),
  buyerAddress: z.string().min(10),
  pricePaidSats: z.number().int().positive(),
  txHash: z.string().min(10),
  btcTxHash: z.string().optional(),
});

app.post('/api/nft-launches/:address/mints', writeLimiter, async (req, res) => {
  const addr = String(req.params.address).toLowerCase();
  const parsed = mintSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
  }
  try {
    const nftLaunch = await prisma.nftLaunch.findUnique({
      where: { contractAddress: addr },
      select: { id: true },
    });
    if (!nftLaunch) return res.status(404).json({ error: 'NFT launch not found' });

    const { tokenId, buyerAddress, pricePaidSats, txHash, btcTxHash } = parsed.data;
    const [mint] = await prisma.$transaction([
      prisma.nftMint.create({
        data: {
          launchId: nftLaunch.id,
          tokenId,
          buyerAddress,
          pricePaidSats,
          txHash,
          btcTxHash,
        },
      }),
      prisma.nftLaunch.update({
        where: { contractAddress: addr },
        data: { totalMinted: { increment: 1 } },
      }),
    ]);
    await broadcast('nft_minted', {
      collectionAddress: addr,
      tokenId,
      buyerAddress,
      pricePaidSats: pricePaidSats.toString(),
    });
    res.status(201).json(mint);
  } catch (error) {
    console.error('[API] Error recording mint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/launches/:tokenAddress/graduate - Mark a launch as graduated
app.post('/api/launches/:tokenAddress/graduate', writeLimiter, async (req, res) => {
  const addr = String(req.params.tokenAddress).toLowerCase();
  try {
    await prisma.launch.update({
      where: { tokenAddress: addr },
      data: { status: 'FINALIZED' },
    });
    await broadcast('launch_finalized', {
      type: 'launch_finalized',
      launchAddress: addr,
    });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Launch not found' });
  }
});

// Helper function to calculate progress percentage
function calculateProgress(currentSupply: string, supplyCap: string): number {
  try {
    const supply = BigInt(currentSupply);
    const cap = BigInt(supplyCap);
    if (cap === BigInt(0)) return 0;

    // Convert to percentage (multiply by 10000 to get 2 decimal places)
    const percentage = (supply * BigInt(10000)) / cap;
    return Number(percentage) / 100;
  } catch {
    return 0;
  }
}

// ─── Bot API Endpoints ─────────────────────────────────────────────────────────

// 1. Link X handle to wallet
app.post('/api/bot/link-wallet', async (req, res) => {
  const { xHandle, btcAddress, evmAddress, signedMessage } = req.body as {
    xHandle?: string; btcAddress?: string; evmAddress?: string; signedMessage?: string;
  };
  if (!xHandle || !btcAddress || !signedMessage)
    return res.status(400).json({ error: 'xHandle, btcAddress, signedMessage required' });
  const clean = xHandle.toLowerCase().replace('@', '');
  try {
    const link = await prisma.xWalletLink.upsert({
      where: { xHandle: clean },
      create: { xHandle: clean, btcAddress, evmAddress, signedMessage },
      update: { btcAddress, evmAddress, signedMessage },
    });
    res.json({ link });
  } catch (error) {
    console.error('[Bot API] Error linking wallet:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Get wallet for an X handle
app.get('/api/bot/wallet/:xHandle', async (req, res) => {
  const handle = req.params.xHandle.toLowerCase().replace('@', '');
  try {
    const link = await prisma.xWalletLink.findUnique({ where: { xHandle: handle } });
    if (!link) return res.status(404).json({ error: 'no_wallet_linked' });
    res.json({ btcAddress: link.btcAddress, evmAddress: link.evmAddress });
  } catch (error) {
    console.error('[Bot API] Error fetching wallet:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Create a bot job (idempotent by tweetId)
app.post('/api/bot/jobs', async (req, res) => {
  const { tweetId, xHandle, command, intentJson, launchAddress, tokenSymbol, amountSats } = req.body as {
    tweetId?: string; xHandle?: string; command?: string; intentJson?: unknown;
    launchAddress?: string; tokenSymbol?: string; amountSats?: string | number;
  };
  if (!tweetId || !xHandle || !command || !intentJson)
    return res.status(400).json({ error: 'tweetId, xHandle, command, intentJson required' });
  try {
    const existing = await prisma.botJob.findUnique({ where: { tweetId } });
    if (existing) return res.json({ job: existing, duplicate: true });
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const job = await prisma.botJob.create({
      data: {
        tweetId,
        xHandle: xHandle.toLowerCase().replace('@', ''),
        command,
        intentJson: typeof intentJson === 'string' ? intentJson : JSON.stringify(intentJson),
        launchAddress: launchAddress ?? null,
        tokenSymbol: tokenSymbol ?? null,
        amountSats: amountSats ? BigInt(amountSats) : null,
        expiresAt,
      },
    });
    res.json({ job });
  } catch (error) {
    console.error('[Bot API] Error creating job:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Get recently-confirmed jobs (bot polls for receipts to post)
// NOTE: must be defined BEFORE /:jobId to avoid route conflict
app.get('/api/bot/jobs/recently-confirmed', async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const jobs = await prisma.botJob.findMany({
      where: { status: 'CONFIRMED', replyTweetId: null, updatedAt: { gt: cutoff } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    res.json({ jobs });
  } catch (error) {
    console.error('[Bot API] Error fetching confirmed jobs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. Get recently-expired jobs that haven't received an expiry reply
// NOTE: must be defined BEFORE /:jobId to avoid route conflict
app.get('/api/bot/jobs/recently-expired', async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const jobs = await prisma.botJob.findMany({
      where: {
        status: 'EXPIRED',
        expiryReplyTweetId: null,
        updatedAt: { gt: cutoff },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    res.json({ jobs });
  } catch (error) {
    console.error('[Bot API] Error fetching recently-expired jobs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Expire old jobs
app.post('/api/bot/jobs/expire-old', async (req, res) => {
  try {
    const result = await prisma.botJob.updateMany({
      where: {
        status: { in: ['PENDING', 'AWAITING_SIGNATURE'] },
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
    res.json({ expired: result.count });
  } catch (error) {
    console.error('[Bot API] Error expiring jobs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Get a single job (used by sign page)
app.get('/api/bot/jobs/:jobId', async (req, res) => {
  try {
    const job = await prisma.botJob.findUnique({ where: { id: req.params.jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job });
  } catch (error) {
    console.error('[Bot API] Error fetching job:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 7. Update job status and wallet
app.patch('/api/bot/jobs/:jobId', async (req, res) => {
  const { status, walletAddress, errorMessage } = req.body as {
    status?: string; walletAddress?: string; errorMessage?: string;
  };
  try {
    const job = await prisma.botJob.update({
      where: { id: req.params.jobId },
      data: {
        ...(status && { status }),
        ...(walletAddress && { walletAddress }),
        ...(errorMessage && { errorMessage }),
      },
    });
    res.json({ job });
  } catch (error) {
    console.error('[Bot API] Error updating job:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 8. Frontend calls this after user signs + submits tx
app.post('/api/bot/jobs/:jobId/execute', async (req, res) => {
  const { btcAddress } = req.body as { btcAddress?: string };
  try {
    const job = await prisma.botJob.findUnique({ where: { id: req.params.jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!['PENDING', 'AWAITING_SIGNATURE'].includes(job.status))
      return res.status(400).json({ error: `Job status is ${job.status}` });
    if (job.expiresAt && job.expiresAt < new Date()) {
      await prisma.botJob.update({ where: { id: job.id }, data: { status: 'EXPIRED' } });
      return res.status(410).json({ error: 'Job expired. Send command again on X.' });
    }
    const updated = await prisma.botJob.update({
      where: { id: job.id },
      data: { status: 'EXECUTING', walletAddress: btcAddress },
    });
    res.json({ job: updated });
  } catch (error) {
    console.error('[Bot API] Error executing job:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 9. Frontend calls this after tx confirms on-chain
app.post('/api/bot/jobs/:jobId/confirm', async (req, res) => {
  const { txHash, btcTxHash, tokensReceived } = req.body as {
    txHash?: string; btcTxHash?: string; tokensReceived?: string;
  };
  try {
    const existing = await prisma.botJob.findUnique({ where: { id: req.params.jobId } });
    if (!existing) return res.status(404).json({ error: 'Job not found' });

    let updatedIntentJson = existing.intentJson;
    if (tokensReceived) {
      try {
        const parsed = JSON.parse(existing.intentJson || '{}') as Record<string, unknown>;
        updatedIntentJson = JSON.stringify({ ...parsed, tokensReceived });
      } catch { /* keep original */ }
    }

    const job = await prisma.botJob.update({
      where: { id: req.params.jobId },
      data: {
        status: 'CONFIRMED',
        txHash: txHash ?? null,
        btcTxHash: btcTxHash ?? null,
        intentJson: updatedIntentJson,
      },
    });

    await broadcast('bot_updates', {
      type: 'job_confirmed',
      jobId: job.id,
      tweetId: job.tweetId,
      xHandle: job.xHandle,
      command: job.command,
      tokenSymbol: job.tokenSymbol,
      amountSats: job.amountSats?.toString(),
      txHash,
      btcTxHash,
      tokensReceived,
      launchAddress: job.launchAddress,
    });

    res.json({ job });
  } catch (error) {
    console.error('[Bot API] Error confirming job:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 10. Mark a job as replied (bot calls this after posting X reply)
app.post('/api/bot/jobs/:jobId/mark-replied', async (req, res) => {
  const { replyTweetId } = req.body as { replyTweetId?: string };
  try {
    const job = await prisma.botJob.update({
      where: { id: req.params.jobId },
      data: { replyTweetId },
    });
    res.json({ job });
  } catch (error) {
    console.error('[Bot API] Error marking job replied:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 12. Mark a job as having received an expiry reply
app.post('/api/bot/jobs/:jobId/mark-expiry-replied', async (req, res) => {
  const { replyTweetId } = req.body as { replyTweetId?: string };
  try {
    const job = await prisma.botJob.update({
      where: { id: req.params.jobId },
      data: { expiryReplyTweetId: replyTweetId },
    });
    res.json({ job });
  } catch (error) {
    console.error('[Bot API] Error marking expiry replied:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 13. Bot stats summary
app.get('/api/bot/stats', async (req, res) => {
  try {
    const [total, confirmed, expired, failed, pending, linkedWallets] = await Promise.all([
      prisma.botJob.count(),
      prisma.botJob.count({ where: { status: 'CONFIRMED' } }),
      prisma.botJob.count({ where: { status: 'EXPIRED' } }),
      prisma.botJob.count({ where: { status: 'FAILED' } }),
      prisma.botJob.count({ where: { status: { in: ['PENDING', 'AWAITING_SIGNATURE', 'EXECUTING'] } } }),
      prisma.xWalletLink.count(),
    ]);
    res.json({ jobs: { total, confirmed, expired, failed, pending }, linkedWallets });
  } catch (error) {
    console.error('[Bot API] Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
  console.log(`[API] CORS origins: ${CORS_ORIGINS.join(', ')}`);
});
