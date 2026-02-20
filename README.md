# MidlLaunch — Bitcoin-Native Token Issuance Protocol

**Status:** Full-stack complete · Staging-ready · PRD v1.3 compliant

## What is MidlLaunch?

A pump.fun-style bonding curve launchpad on Bitcoin L2 (Midl Network). Create fungible tokens or NFT collections, trade with BTC, and watch prices rise with every purchase — all settled on Bitcoin.

**In scope (v1):**
- Buy-side linear bonding curve — deterministic, on-chain pricing
- Bitcoin-native settlement — sign with Xverse wallet
- Trust-minimized via Midl validators and TSS vaults
- NFT collection launches with per-mint BTC pricing

**Out of scope (per PRD):**
- Sell-side curve, AMM, or liquidity migration
- Anti-bot or fairness mechanisms
- Secondary market

---

## Project Structure

```
midllaunch/
├── contracts/                    # Solidity smart contracts
│   ├── LaunchFactory.sol         # Factory for deploying token launches
│   ├── LaunchToken.sol           # ERC20 with immutable supply cap
│   ├── BondingCurvePrimaryMarket.sol  # Linear curve, O(1) closed-form math
│   ├── NftLaunchFactory.sol      # NFT collection factory
│   └── NftCollection.sol         # ERC721 with mint price enforcement
├── test/
│   └── MidlLaunch.test.ts        # 16/16 contract tests passing
├── scripts/
│   ├── deploy.ts                 # Deploy contracts to Midl staging
│   └── test-launch.ts            # Create demo launch + purchase
├── backend/                      # Express API + WebSocket server
│   └── src/
│       ├── api/index.ts          # REST endpoints + Zod validation
│       ├── db/prisma/            # PostgreSQL schema + migrations
│       ├── indexer/              # On-chain event indexer
│       └── ws/                   # WebSocket server (Redis pub/sub)
├── frontend/                     # Next.js 14 App Router frontend
│   └── src/
│       ├── app/                  # Pages (home, browse, launch detail, create, portfolio)
│       ├── components/           # UI components, trading widgets, layout
│       ├── lib/                  # API client, hooks, wallet utils, IPFS upload
│       └── types/                # Shared TypeScript types
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis instance
- Midl staging RPC access

### 1. Contracts

```bash
npm install
npm test                    # Run 16 contract tests
npm run compile             # Compile Solidity
npm run deploy:staging      # Deploy to Midl staging
```

### 2. Backend

```bash
cd backend
cp .env.example .env        # Configure DB_URL, REDIS_URL, RPC_URL
npm install
npx prisma migrate dev      # Run DB migrations
npm run dev                 # Start API + WebSocket server on :4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local  # Set NEXT_PUBLIC_API_URL
npm install
npm run dev                 # Start Next.js on :3000
```

---

## Smart Contracts

### BondingCurvePrimaryMarket

- **Linear price:** `P(s) = basePrice + s × priceIncrement`
- **Closed-form buy math (Appendix A):** Babylonian sqrt — no loops, O(1) gas
- **Gas cost:** ~200–300k per purchase
- **Slippage protection:** `minTokensOut` parameter

**Parameter bounds (factory-enforced):**

| Parameter | Min | Max |
|-----------|-----|-----|
| Base Price | 1,000 sats | 1,000,000 sats |
| Price Increment | 1 sat | 10,000 sats |
| Supply Cap | 1M tokens | 21M tokens |

### Test Coverage (16/16 passing)

Supply cap enforcement · Monotonic price · Slippage protection · Parameter bounds · Event completeness (intentId) · Unauthorized mint protection · Gas O(1) · Admin scoping

---

## Backend API

REST API served at `http://localhost:4000`.

| Endpoint | Description |
|----------|-------------|
| `GET /api/launches` | List launches (filter by status, sort, paginate) |
| `GET /api/launches/trending` | Trending launches by score |
| `GET /api/launches/:address` | Launch detail |
| `GET /api/launches/:address/purchases` | Purchase history |
| `GET /api/launches/:address/price-history` | OHLC price points |
| `GET /api/launches/:address/comments` | Comments |
| `POST /api/launches/:address/comments` | Post a comment |
| `PATCH /api/launches/:address/metadata` | Update metadata (CID, socials) |
| `GET /api/nft-launches` | NFT collection list |
| `GET /api/user/:address/holdings` | Portfolio holdings + P&L |
| `GET /api/user/:address/activity` | Purchase history |
| `GET /api/activity` | Global activity feed |
| `GET /api/stats` | Platform stats |

**WebSocket** (port 4000): broadcasts `purchase`, `price_update`, `nft_minted` events.

---

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Hero, stats, trending tokens, recent activity, NFT teaser |
| `/launches` | Browse tokens + NFTs, sort/filter, live search |
| `/launch/[address]` | Token detail: bonding curve + price history chart, buy widget, transactions, comments, holders |
| `/create` | Create token launch with IPFS metadata upload |
| `/launch-nft` | Create NFT collection launch |
| `/portfolio` | Holdings with unrealized P&L, activity history |
| `/transactions` | Transaction lifecycle tracker |

**Key features:**
- Real-time buy feed via WebSocket
- Bonding curve SVG chart + price history line chart
- One-click BTC purchase (Xverse wallet)
- Toast notifications for all user actions
- Canvas-confetti on token graduation (100% supply sold)
- Page transition animations
- Mobile-first with bottom navigation bar
- IPFS/Pinata image upload in create forms

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contracts | Solidity ^0.8.24, Hardhat, OpenZeppelin |
| Backend | Express.js, PostgreSQL, Prisma ORM, Redis, Zod |
| Frontend | Next.js 14 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, CSS custom properties (design tokens) |
| Data fetching | TanStack Query v5 |
| Wallet | @midl/react, @midl/executor-react, Xverse |
| Images | next/image with Pinata/IPFS remote patterns |

---

## Environment Variables

**Backend** (`backend/.env`):

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
MIDL_RPC_URL=https://rpc.staging.midl.xyz
FACTORY_ADDRESS=0x...
NFT_FACTORY_ADDRESS=0x...
```

**Frontend** (`frontend/.env.local`):

```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
PINATA_API_KEY=...
PINATA_SECRET_API_KEY=...
```

---

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for full staging deployment guide.

```bash
# Deploy contracts
npm run deploy:staging

# Start backend
cd backend && npm run start

# Build + start frontend
cd frontend && npm run build && npm run start
```

---

## Security & Trust Model

- **Trust-minimized** (not trustless): Midl validators control TSS vaults
- **On-chain guarantees**: supply cap, price monotonicity, parameter bounds — all enforced in Solidity
- **Off-chain trust**: frontend data accuracy, indexer availability, metadata correctness
- **Bitcoin finality**: settlement requires N BTC confirmations before Midl execution

---

---

## Running MidlLaunchBot

### Prerequisites
1. Sign up at developer.x.com
2. Create a project and app
3. Generate OAuth 1.0a keys (API Key, API Secret, Access Token, Access Token Secret)
4. Purchase X API credits ($20 is enough to start — pay-per-use, no subscription)
5. Enable auto-recharge at $5 threshold in Developer Console to avoid interruption

### Setup
```bash
cp bot/.env.example bot/.env
# Fill in X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
```

### Run
```bash
npm run bot
```

### Cost estimate
At 100 commands/month:
- 100 posts read x $0.005 = $0.50
- 100 replies x $0.010 = $1.00
- Total: ~$1.50/month

### Architecture — Why Non-Custodial Is Better

Most social trading bots are custodial: they hold your private keys and sign on your behalf.
MidlLaunchBot is different.

**The flow:**
1. You send a command on X
2. Bot creates a signing request and replies with a link
3. You tap the link — your Xverse wallet signs the actual Bitcoin PSBT
4. Bot posts the on-chain proof once confirmed

**Why this matters:**
- Your keys never leave your wallet
- The bot cannot move your funds without your signature
- Every transaction is verifiable on Bitcoin mempool + Midl Blockscout
- If the bot is compromised, no user funds are at risk

"We built non-custodial social trading on a Bitcoin L2.
The bot routes intent. The wallet signs. The chain proves."

### Supported commands (tag @midllaunchbot)
```
@midllaunchbot buy $TOKEN 0.001 BTC
@midllaunchbot buy $TOKEN 100000 sats
@midllaunchbot sell $TOKEN 50%
@midllaunchbot sell $TOKEN all
@midllaunchbot launch MyToken ($MYT)
@midllaunchbot portfolio
@midllaunchbot link
@midllaunchbot help
```

---

## License

ISC
