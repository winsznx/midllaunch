# MidlLaunch — Full Platform Agent Prompt
## Drop this file into your project root as `AGENT_PROMPT.md` then run: `claude < AGENT_PROMPT.md` or paste into Claude Code

---

## CRITICAL INSTRUCTION TO AGENT

You are building **MidlLaunch** — the pump.fun of Bitcoin L2, built on Midl's EVM execution layer. This is a hackathon submission for **Midl VibeHack BTC 2026**. The judges want to see a working dApp that feels like a real product, not a proof of concept.

**Before writing a single line of code, you MUST:**
1. Use the TodoWrite tool to create a complete master task list of every task you will do
2. Number them sequentially (Task 001, Task 002... Task N)
3. Group them by phase
4. Only then start executing, checking off tasks as you go
5. Never skip ahead — complete tasks in order within each phase
6. After every 10 tasks, re-read the task list and re-orient

**Context files to read FIRST before planning:**
- `MIDLLAUNCH_AUDIT_AND_DESIGN_GUIDE.md` — audit findings and design spec (in project root)
- `frontend/src/` — existing Next.js frontend code
- `backend/src/` — existing Express backend code  
- `contracts/` — existing Solidity contracts
- `frontend/src/lib/midl/config.ts` — current Midl SDK config (HAS A BUG)
- `frontend/src/app/create/page.tsx` — current create flow
- `frontend/src/app/launch/[address]/page.tsx` — current detail page

---

## WHAT EXISTS (READ BEFORE PLANNING)

### Already Built (do NOT rebuild from scratch, REFACTOR):
- Next.js 14 frontend with App Router, TypeScript, Tailwind
- Express backend with 8 REST API endpoints on port 4000
- Event indexer for Midl blockchain events
- WebSocket server on port 8080
- Prisma schema with SQLite (Launch, Purchase, BlockTracking, LaunchFinalization)
- Real Midl SDK integration: `@midl/core`, `@midl/react`, `@midl/executor-react`, `@midl/connectors`
- Xverse wallet connection via `xverseConnector()`
- Transaction flow hooks: `useAddTxIntention`, `useSignIntention`, `useFinalizeBTCTransaction`, `useSendBTCTransactions`
- LaunchFactory.sol and BondingCurvePrimaryMarket.sol (16/16 tests passing)
- 6 frontend pages: Home, Browse (/launches), Detail (/launch/[address]), Create (/create), Portfolio, Transactions
- Design system with orange theme (needs a COMPLETE redesign — see design spec below)

### Critical Bug (FIX THIS FIRST — Task 001):
In `frontend/src/lib/midl/config.ts`, the `xverseConnector()` is missing the correct indexer URL.
The current config causes "No selected UTXOs" error because Xverse queries the wrong mempool endpoint.

**WRONG** (what we likely have):
```ts
xverseConnector()
// or
xverseConnector({ purposes: ['payment', 'ordinals'] })
```

**CORRECT** (what it must be):
```ts
import { xverseConnector } from '@midl/connectors';
// The indexerUrl MUST be the Xverse-specific regtest indexer
xverseConnector({
  network: {
    type: 'Regtest',
    address: 'https://mempool.staging.midl.xyz',
    bip322SigHash: '',
  },
  // This is the critical fix — Xverse needs its own indexer for PSBT validation
  // Without this, it hits the wrong endpoint, gets HTML, throws "No selected UTXOs"
})
```

Look at https://github.com/Ticoworld/axis to understand what config they used — they solved this exact bug with help from Midl team on Discord. The key config their XVERSE_UTXO_BUG_CONTEXT.md documented: use `indexerUrl: "https://api-regtest-midl.xverse.app/"` and the network type must be `Regtest` not testnet. Check the @midl/connectors package's xverseConnector type definitions to find the exact parameter names and apply the correct config.

Also check:
- Chain ID must be **15001** (not 1001) in WagmiMidlProvider config in `frontend/src/app/layout.tsx`
- Verify `testnet` from `@midl/core` equals chain ID 15001, otherwise use a custom network

---

## PHASE STRUCTURE FOR PLANNING

Create tasks in these phases. Estimate at least 80-120 tasks total:

```
PHASE 0: AUDIT & CRITICAL FIXES (Tasks 001-015)
PHASE 1: PROJECT EXPANSION — Backend + Schema (Tasks 016-035)
PHASE 2: DESIGN SYSTEM OVERHAUL (Tasks 036-055)
PHASE 3: LANDING PAGE (Tasks 056-065)
PHASE 4: PAGE REDESIGNS — Each Page (Tasks 066-095)
PHASE 5: IPFS + NEW FEATURES (Tasks 096-110)
PHASE 6: RESPONSIVE + POLISH (Tasks 111-120+)
```

---

## PHASE 0: AUDIT & CRITICAL FIXES

### Task 001 — Fix Xverse connector indexerUrl bug
File: `frontend/src/lib/midl/config.ts`
Read the installed `@midl/connectors` package type definitions to find exact parameter shape of `xverseConnector()`. Apply the correct `Regtest` network config with `indexerUrl: "https://api-regtest-midl.xverse.app/"`. This is the SINGLE most important fix in the entire codebase.

### Task 002 — Fix chain ID to 15001
File: `frontend/src/app/layout.tsx`
Ensure WagmiMidlProvider is configured with chain ID 15001. Check that `testnet` from `@midl/core` resolves to 15001. If it resolves to anything else, define the chain manually.

### Task 003 — Verify LaunchFactory ABI exists
Check `frontend/src/lib/contracts/LaunchFactory.abi.json`. If it's empty or missing, extract it from `artifacts/contracts/LaunchFactory.sol/LaunchFactory.json` and populate it. Same for `BondingCurvePrimaryMarket.abi.json`.

### Task 004 — Check factory address configuration
In `frontend/src/lib/contracts/config.ts` and `frontend/.env.local`, check if `LAUNCH_FACTORY_ADDRESS` is still the Hardhat placeholder `0x5FbDB2315678afecb367f032d93F642f64180aa3`. If it is, add a clear comment that it needs to be replaced after deployment. Do NOT use the placeholder address in production mode.

### Task 005 — Verify transaction flow order in create page
In `frontend/src/app/create/page.tsx`, verify the SDK call order:
1. `addTxIntentionAsync` → 2. `finalizeBTCTransactionAsync` → 3. `signIntentionAsync` → 4. `sendBTCTransactionsAsync`
Fix if wrong. Ensure error states are properly caught and surfaced to the user.

### Task 006 — Verify transaction flow in buy page
Same verification for `frontend/src/app/launch/[address]/page.tsx` buy flow. The buy() function on the BondingCurvePrimaryMarket contract takes: `(bytes32 intentId, uint256 minTokensOut)`. Verify `encodeFunctionData` is using correct args. Check slippage calculation is correctly computing `minTokensOut`.

### Task 007 — Fix backend CORS
In `backend/.env`, ensure `CORS_ORIGIN` matches the exact port frontend runs on. Check if the frontend runs on 3000, 3001, or 3002. Set CORS to allow multiple origins or use a wildcard for development.

### Task 008 — Audit indexer contract address
In `backend/src/indexer/index.ts`, check what contract address the indexer is listening to. It must match the deployed LaunchFactory address. Also check event ABIs match the contract's actual events (including `intentId` field per PRD Section 13).

### Task 009 — Add SSL error retry to indexer
The indexer suffers from `ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC` errors. Add exponential backoff retry logic so it doesn't crash. Implement a circuit breaker: if 5 consecutive requests fail, wait 30 seconds before retrying.

### Task 010 — Audit database schema for new fields
Check `backend/prisma/schema.prisma`. The Launch table needs these columns for the expanded app:
- `name`, `symbol`, `supplyCap`, `basePrice`, `priceIncrement`, `totalSupplySold`
- `totalBTCDepositedSats`, `isFinalized`, `intentId`
- `metadataCID` (for IPFS metadata — add this now)
- `description`, `imageUrl`, `twitterUrl`, `telegramUrl`, `websiteUrl` (social metadata)
- `launchType` (enum: TOKEN, NFT — for expansion)
Add any missing columns and run a migration.

### Task 011 — Add API endpoint for metadata
Add `PATCH /api/launches/:tokenAddress/metadata` to `backend/src/api/index.ts`. This allows the frontend to store IPFS metadata CID and social fields before/after transaction confirmation. This is the side-channel for off-chain metadata storage.

### Task 012 — Verify WebSocket client reconnects
In `frontend/src/lib/websocket/client.ts`, ensure there's reconnection logic with backoff. If the WS drops, it should silently reconnect, not show errors.

### Task 013 — Run full build verification
`cd frontend && npm run build` — fix every TypeScript error and warning before proceeding to Phase 1.

### Task 014 — Verify React Query hooks
In `frontend/src/lib/hooks/useLaunches.ts`, verify fetch URLs use `process.env.NEXT_PUBLIC_API_URL` as the base, not hardcoded localhost. Verify response types match the actual API response shape.

### Task 015 — Document environment variables
Create/update `frontend/.env.local.example` and `backend/.env.example` with all required variables documented. Ensure `PINATA_API_KEY` and `PINATA_SECRET_KEY` are added for upcoming IPFS work.

---

## PHASE 1: PROJECT EXPANSION — Backend + Schema

### Task 016 — Expand Prisma schema for NFT launches
Add a `NftLaunch` model to `schema.prisma`:
```prisma
model NftLaunch {
  id            String   @id @default(cuid())
  contractAddress String @unique
  name          String
  symbol        String
  totalSupply   Int
  mintPrice     BigInt   // in sats
  maxPerWallet  Int
  metadataCID   String?
  imageUrl      String?
  description   String?
  twitterUrl    String?
  telegramUrl   String?
  websiteUrl    String?
  totalMinted   Int      @default(0)
  isFinalized   Boolean  @default(false)
  creatorAddress String
  createdAt     DateTime @default(now())
  mints         NftMint[]
}

model NftMint {
  id          String   @id @default(cuid())
  launchId    String
  launch      NftLaunch @relation(fields: [launchId], references: [id])
  tokenId     Int
  buyerAddress String
  pricePaidSats BigInt
  txHash      String
  btcTxHash   String?
  createdAt   DateTime @default(now())
}
```

### Task 017 — Add global stats to API
Enhance `GET /api/stats` to return:
```json
{
  "totalLaunches": 0,
  "activeLaunches": 0,
  "finalizedLaunches": 0,
  "totalBTCDeposited": "0",
  "totalNFTLaunches": 0,
  "purchases24h": 0,
  "uniqueCreators": 0,
  "uniqueBuyers": 0
}
```

### Task 018 — Add trending algorithm endpoint
Add `GET /api/launches/trending` that scores tokens by:
`score = (volumeLast1h × 0.4) + (uniqueBuyersLast1h × 0.3) + (recencyScore × 0.3)`
Return top 10. Add Redis caching with 60-second TTL.

### Task 019 — Add near-graduation endpoint
Add `GET /api/launches/graduating` — returns launches where `totalSupplySold / supplyCap >= 0.7`. These are "near graduation" and shown on a special tab.

### Task 020 — Add search endpoint
Add `GET /api/launches/search?q=` that searches name and symbol fields (case-insensitive LIKE query).

### Task 021 — Add comments table and API
```prisma
model Comment {
  id            String   @id @default(cuid())
  launchAddress String
  authorAddress String
  content       String   @db.Text
  createdAt     DateTime @default(now())
}
```
Add `GET /api/launches/:address/comments` and `POST /api/launches/:address/comments`.

### Task 022 — Add NFT API routes
Add the following routes to the API:
- `GET /api/nft-launches` (with pagination, filter, sort)
- `GET /api/nft-launches/:address`
- `GET /api/nft-launches/:address/mints`
- `POST /api/nft-launches/:address/metadata`

### Task 023 — Add unified activity feed endpoint
Add `GET /api/activity` — returns the last 50 events across ALL launches (buys + creates + mints), sorted by time. Used for the homepage live ticker.

### Task 024 — Add price history endpoint
Add `GET /api/launches/:address/price-history` — returns array of `{timestamp, price, supply}` data points derived from Purchase history. Used for the price chart on token detail pages.

### Task 025 — Run Prisma migrations
After all schema changes, run `npx prisma migrate dev --name "platform-expansion"` and verify the migration succeeds.

### Task 026 — Add portfolio enhancements
Enhance `GET /api/user/:address/holdings` to include:
- Holdings for both TOKEN and NFT launches
- Unrealized P&L calculation (current price vs avg buy price)
- Total BTC invested
- Current estimated value

### Task 027 — Add WebSocket events for NFT
Extend WebSocket server to broadcast `nft_minted` events alongside existing token events.

### Task 028 — Add rate limiting to API
Use `express-rate-limit` package. Apply:
- 100 req/min to read endpoints
- 10 req/min to write endpoints
- 5 req/min to the create launch endpoint

### Task 029 — Add request validation middleware
Use `zod` or manual validation. Validate all incoming POST body params. Return 400 with clear error messages on invalid input.

### Task 030 — Verify backend build
`cd backend && npx tsc --noEmit` — fix all TypeScript errors.

### Task 031-035 — Reserved for any schema/API issues discovered during Tasks 016-030

---

## PHASE 2: DESIGN SYSTEM OVERHAUL

**CRITICAL DESIGN DIRECTION**: The aesthetic is **Premium Crypto Glass** — a dark luxury trading terminal that feels like Bloomberg Terminal met a high-end crypto exchange. Think: warm dark backgrounds with sharp glassmorphism panels, BTC orange as the only warm accent, data-dense but breathing, alive with micro-animations. The reference images show this direction — the Dribbble shots with candlestick charts embedded in glass panels, activity feeds with subtle separator lines, token images dominating card space with data as overlay.

**NOT**: purple gradients, rainbow anything, generic card borders, Inter font, flat design.

### Task 036 — Install typography packages
```bash
# In frontend directory
npm install @fontsource/syne @fontsource/ibm-plex-mono @fontsource/manrope
```
These are self-hosted, no external dependency needed.

### Task 037 — Rewrite globals.css from scratch
Replace the entire `frontend/src/app/globals.css` with:

```css
/* === FONTS === */
@import '@fontsource/syne/700.css';
@import '@fontsource/syne/800.css';
@import '@fontsource/ibm-plex-mono/400.css';
@import '@fontsource/ibm-plex-mono/500.css';
@import '@fontsource/manrope/400.css';
@import '@fontsource/manrope/500.css';
@import '@fontsource/manrope/600.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

/* === CSS CUSTOM PROPERTIES === */
:root {
  /* Backgrounds — warm dark, not cold black */
  --bg-base: #0a0908;
  --bg-surface: #111009;
  --bg-elevated: #191714;
  --bg-glass: rgba(25, 23, 20, 0.6);
  --bg-glass-border: rgba(255, 255, 255, 0.06);
  --bg-border: #242018;

  /* BTC Orange — used sparingly, maximum impact */
  --orange-50: rgba(249, 115, 22, 0.08);
  --orange-100: rgba(249, 115, 22, 0.15);
  --orange-400: #fb923c;
  --orange-500: #f97316;
  --orange-glow: 0 0 20px rgba(249, 115, 22, 0.3), 0 0 60px rgba(249, 115, 22, 0.1);

  /* Semantic colors */
  --green-500: #22c55e;
  --green-dim: rgba(34, 197, 94, 0.1);
  --red-500: #ef4444;
  --red-dim: rgba(239, 68, 68, 0.1);
  --gold: #f5c518;
  --blue-accent: #3b82f6;

  /* Text — warm whites, not pure white */
  --text-primary: #f2ede4;
  --text-secondary: #a89474;
  --text-tertiary: #635847;
  --text-muted: #3d3028;

  /* Fonts */
  --font-display: 'Syne', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
  --font-body: 'Manrope', sans-serif;

  /* Spacing */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  /* Glass effect */
  --glass-blur: blur(16px);
  --glass-bg: rgba(25, 23, 20, 0.65);
  --glass-border: 1px solid rgba(255, 255, 255, 0.07);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

/* Light mode — warm cream, not sterile white */
[data-theme="light"] {
  --bg-base: #faf7f0;
  --bg-surface: #f2ede3;
  --bg-elevated: #e8e0d2;
  --bg-glass: rgba(250, 247, 240, 0.75);
  --bg-glass-border: rgba(0, 0, 0, 0.08);
  --bg-border: #d8cfc0;
  --text-primary: #1a1510;
  --text-secondary: #5c4f3a;
  --text-tertiary: #8c7a62;
  --text-muted: #b8a890;
  --glass-bg: rgba(250, 247, 240, 0.75);
  --glass-border: 1px solid rgba(0, 0, 0, 0.08);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* === BASE STYLES === */
* { box-sizing: border-box; margin: 0; padding: 0; }

html {
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-body);
  background-color: var(--bg-base);
  color: var(--text-primary);
  line-height: 1.6;
  overflow-x: hidden;
}

/* Grain overlay for depth — subtle noise texture */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
  opacity: 0.025;
  pointer-events: none;
  z-index: 999;
}

/* === TYPOGRAPHY === */
h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--text-primary);
}

h4, h5, h6 {
  font-family: var(--font-body);
  font-weight: 600;
}

.font-mono, code, .price, .address, .tx-hash {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

/* === GLASS COMPONENTS === */
.glass {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: var(--glass-border);
  box-shadow: var(--glass-shadow);
  border-radius: var(--radius-lg);
}

.glass-sm {
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: var(--glass-border);
  border-radius: var(--radius-md);
}

.glass-surface {
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
}

/* === BUTTONS === */
.btn-primary {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 14px;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  background: var(--orange-500);
  color: #fff;
  border: none;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.2s ease;
  letter-spacing: 0.01em;
}

.btn-primary::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -60%;
  width: 40%;
  height: 200%;
  background: rgba(255, 255, 255, 0.25);
  transform: skewX(-20deg);
  transition: left 0.4s ease;
}

.btn-primary:hover {
  background: var(--orange-400);
  transform: translateY(-1px);
  box-shadow: var(--orange-glow);
}

.btn-primary:hover::after {
  left: 120%;
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-ghost {
  font-family: var(--font-body);
  font-weight: 500;
  font-size: 14px;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--bg-border);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-ghost:hover {
  border-color: var(--orange-500);
  color: var(--orange-500);
  background: var(--orange-50);
}

.btn-danger {
  background: var(--red-500);
  color: #fff;
}

/* === BADGES === */
.badge-live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 100px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  background: var(--green-dim);
  color: var(--green-500);
  border: 1px solid rgba(34, 197, 94, 0.2);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.badge-live::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--green-500);
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.badge-orange {
  padding: 2px 8px;
  border-radius: 100px;
  font-family: var(--font-mono);
  font-size: 10px;
  background: var(--orange-100);
  color: var(--orange-500);
  border: 1px solid rgba(249, 115, 22, 0.2);
}

/* === PRICE FLASH ANIMATIONS === */
@keyframes flash-up {
  0% { background: var(--green-dim); color: var(--green-500); }
  100% { background: transparent; color: inherit; }
}

@keyframes flash-down {
  0% { background: var(--red-dim); color: var(--red-500); }
  100% { background: transparent; color: inherit; }
}

.price-up { animation: flash-up 1s ease-out forwards; }
.price-down { animation: flash-down 1s ease-out forwards; }

/* === PROGRESS BAR === */
.progress-bar-container {
  height: 4px;
  background: var(--bg-border);
  border-radius: 100px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 100px;
  transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Color shifts based on fill % — set via JS/inline style */
.progress-bar-fill[data-level="low"] { background: var(--orange-500); }
.progress-bar-fill[data-level="mid"] { background: var(--gold); }
.progress-bar-fill[data-level="high"] { background: var(--green-500); }

/* === INPUT FIELDS === */
.input-field {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-field:focus {
  border-color: var(--orange-500);
  box-shadow: 0 0 0 3px var(--orange-50);
}

.input-field::placeholder { color: var(--text-tertiary); }

/* === SCROLLBAR === */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg-base); }
::-webkit-scrollbar-thumb { background: var(--bg-border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }

/* === CARD STAGGER ANIMATION === */
.card-stagger > * {
  opacity: 0;
  transform: translateY(16px);
  animation: card-appear 0.4s ease forwards;
}

.card-stagger > *:nth-child(1) { animation-delay: 0.05s; }
.card-stagger > *:nth-child(2) { animation-delay: 0.10s; }
.card-stagger > *:nth-child(3) { animation-delay: 0.15s; }
.card-stagger > *:nth-child(4) { animation-delay: 0.20s; }
.card-stagger > *:nth-child(5) { animation-delay: 0.25s; }
.card-stagger > *:nth-child(6) { animation-delay: 0.30s; }
.card-stagger > *:nth-child(n+7) { animation-delay: 0.35s; }

@keyframes card-appear {
  to { opacity: 1; transform: translateY(0); }
}

/* Slide in from bottom for activity feed */
@keyframes slide-in-bottom {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.activity-item-new { animation: slide-in-bottom 0.3s ease; }

/* === ADDRESS MASK === */
.address-fade {
  display: inline-block;
  max-width: 120px;
  overflow: hidden;
  white-space: nowrap;
  -webkit-mask-image: linear-gradient(to right, black 70%, transparent 100%);
  mask-image: linear-gradient(to right, black 70%, transparent 100%);
}

/* === LIVE TICKER === */
@keyframes ticker-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.ticker-track {
  display: flex;
  animation: ticker-scroll 30s linear infinite;
  white-space: nowrap;
}

.ticker-track:hover { animation-play-state: paused; }

/* === GLASSMORPHISM CARD HOVER === */
.token-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 1px solid var(--bg-glass-border);
  background: var(--bg-surface);
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
  cursor: pointer;
}

.token-card:hover {
  transform: translateY(-3px);
  border-color: rgba(249, 115, 22, 0.3);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(249, 115, 22, 0.1);
}

.token-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.04) 0%, transparent 60%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.token-card:hover::before { opacity: 1; }

/* === CONNECT WALLET PULSE === */
.wallet-connect-pulse {
  position: relative;
}

.wallet-connect-pulse::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 1px solid var(--orange-500);
  opacity: 0;
  animation: wallet-pulse 2.5s ease-in-out infinite;
}

@keyframes wallet-pulse {
  0%, 100% { opacity: 0; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.05); }
}
```

### Task 038 — Update Tailwind config
Update `tailwind.config.ts` to use CSS variables as the color palette, add custom font families, and ensure the `darkMode` is set to `['class', '[data-theme="dark"]']`.

### Task 039 — Create theme toggle component
Create `frontend/src/components/ui/ThemeToggle.tsx`. Use a moon/sun SVG icon (not a toggle switch). Store theme in `localStorage` under key `midl_theme`. Apply `data-theme` attribute to `<html>` element. Initialize from localStorage on mount with `useEffect`.

### Task 040 — Create reusable component library
Create these components in `frontend/src/components/ui/`:
- `GlassCard.tsx` — wrapper with glass effect, accepts className prop
- `StatPill.tsx` — shows a label + number pill (used in stats bar)  
- `PriceDisplay.tsx` — shows price with flash animation on change
- `AddressChip.tsx` — truncated address with copy-on-click
- `ProgressBar.tsx` — bonding curve progress with color levels
- `Badge.tsx` — live badge, orange badge, etc.
- `Spinner.tsx` — loading indicator matching the design system
- `EmptyState.tsx` — when there's no data, stylized empty state
- `ErrorState.tsx` — when API fails, user-friendly error

### Task 041 — Create TokenCard component
Create `frontend/src/components/tokens/TokenCard.tsx`. This is the MOST IMPORTANT component visually.

Structure:
```
[Token image — 180px tall, object-cover, with gradient overlay at bottom]
[LIVE badge — top-right, only if traded in last 60s]
[Name + ticker row]
[Market cap + price change %]
[Progress bar toward supply cap]
[Creator address (faded) + time ago]
```

Token image fallback when no image: generate a deterministic gradient from the token address using a hash function (XOR the bytes to get hue values). Example: `hsl(${hash % 360}, 65%, 45%)` to `hsl(${(hash + 60) % 360}, 55%, 35%)`.

The card should accept: `launch: Launch` prop with all the data. Format price in sats. Format market cap in BTC. Show % change if available.

### Task 042 — Create NftCard component
Similar structure to TokenCard but shows:
- NFT collection image
- Name + total supply
- Mint price in sats
- Minted / Total supply progress bar
- "MINT NOW" badge if under 100%

### Task 043 — Update layout.tsx — main shell
Redesign the app shell:
- Sticky header at top (64px tall), glass background with blur
- Footer only on landing/marketing pages, not on app pages
- Route-based scroll reset: on every navigation, `window.scrollTo(0, 0)` and `document.body.scrollTop = 0`
- Theme attribute applied to `<html>` from context
- Toaster/notification system (install `react-hot-toast` or use a custom implementation)

### Task 044 — Redesign Header component
The new header should have:

**Desktop layout:**
```
[Logo: ₿ MidlLaunch — Syne font, orange ₿ symbol] [Browse] [Launch Token] [Launch NFT] [Portfolio] [Transactions]      [🌙 theme toggle] [Connect Wallet btn]
```

**Wallet button states:**
- Not connected: orange glow pulse effect, text "Connect Wallet"
- Connecting: spinner
- Connected: shows truncated BTC address + BTC balance, green dot indicator, dropdown on click (shows full address, disconnect option)

**Mobile:** Hamburger menu that slides in from right as a glass overlay panel.

### Task 045 — Global live ticker bar
Add a 28px tall scrolling ticker bar BELOW the header (not inside it). It shows the last 20 activity events from `/api/activity` as a scrolling marquee:
```
[🟢 bc1q...a3f4 bought 1,240 PEPBTC for 0.003 BTC] [•] [🟢 bc1q...x7d2 launched DOGEBTC] [•] ...
```
The ticker pauses on hover. It auto-refreshes every 30 seconds. WebSocket events push new items to the front.

### Task 046 — Create notification/toast system
Install `react-hot-toast`. Configure with custom styling matching the design system — dark glass background, orange accent for success, red for error. Show notifications for:
- Wallet connected/disconnected
- Transaction submitted
- Transaction confirmed
- Transaction failed
- Copy to clipboard

---

## PHASE 3: LANDING PAGE

The landing page is `/` — the entry point before users "enter the app." It's a marketing/showcase page. The actual app starts at `/app` (or keep `/` as app home — but give it a landing section above the discovery section).

### Task 047 — Design decision: Landing vs App Home
**Decision**: Keep `/` as the primary app page but give it a hero section at the top for first-time visitors. The hero should collapse/hide once the user has connected their wallet (stored in localStorage). This way returning users see the discovery feed immediately.

### Task 048 — Build Landing Hero Section
The hero section lives at the top of the home page. It should be visually spectacular:

**Layout** (full viewport height minus header):
- Left side: Large heading text + subheading + CTAs
- Right side: Animated visualization — a 3D-ish bonding curve line chart that animates in, showing a token price going up along an orange curve

**Heading**: Use Syne font, 72px on desktop:
```
Bitcoin Token Launches
Made for Degens.
Built on Bitcoin.
```

**Subheading** (Manrope, 18px, muted):
```
The first bonding curve launchpad on Bitcoin L2.
Create tokens, trade with BTC, go to the moon.
```

**CTAs**: 
- Primary: "Browse Tokens →" (orange button, large)
- Secondary: "Launch a Token" (ghost button)

**Background**: Radial gradient glow from center in deep orange (#f97316 at 5% opacity), animated subtly. Small floating particles if possible in CSS.

**Stats bar** (below hero):
```
[1,052 Tokens Launched] [₿ 57.3 BTC Raised] [145 Unique Creators] [12 Near Graduation]
```
Each stat animates up from 0 when it enters viewport (IntersectionObserver).

### Task 049 — How It Works section
Three steps with glass cards:

```
[1. Connect Wallet]        [2. Launch or Buy]         [3. Watch it Moon]
Xverse wallet. No          Fill the form. Sign         Bonding curve drives
sign-up required.          with BTC. Go live in        price up with every
                           seconds.                    purchase.
```

### Task 050 — Feature strip (launchpad types)
Horizontal strip showing:
```
[🟠 Token Launches]  [🖼️ NFT Launches]  [📈 Bonding Curves]  [⚡ Real BTC Settlement]
```
Each with a short description. On mobile this becomes a horizontal scroll.

### Task 051 — Featured/Trending tokens section on home
Below the hero: "Trending Now" section showing top 6 TokenCards with the card stagger animation. "View all →" link to /launches.

### Task 052 — Recent activity on home
A condensed version of the live activity feed: last 10 events in a clean list. Each row:
```
[avatar circle with initial] bc1q...a3f4 bought 1,240 PEPBTC · 2m ago [₿ 0.003]
```

### Task 053 — NFT teaser section on home
A section below tokens: "NFT Launches Coming" with 3 placeholder cards showing "SOON" state. This establishes that MidlLaunch is not just tokens.

### Task 054 — Footer
Simple footer with:
- Logo + tagline
- Links: Browse, Launch Token, Launch NFT, Portfolio
- "Built on Midl Network" with Midl logo
- Links: mempool.staging.midl.xyz | blockscout.staging.midl.xyz
- Trust disclaimer (MOVED here from hero — "MidlLaunch operates with trust-minimized validator settlement. Always verify on explorers.")
- Theme toggle (second instance, in footer)

### Task 055 — Mobile responsive landing page
Verify every landing section is fully responsive. On mobile:
- Hero: full-width, no right-side chart visualization, taller padding
- Stats bar: 2×2 grid
- Feature strip: horizontal scroll
- Cards: single column

---

## PHASE 4: PAGE REDESIGNS

### BROWSE PAGE (`/launches`)

### Task 056 — Browse page tab system
Add 5 filter tabs above the grid:
```
[🔥 Trending] [🆕 New] [📈 Market Cap] [⚡ Last Trade] [🎓 Near Graduation]
```
Each tab changes the `sortBy` query parameter. The active tab has an orange bottom border indicator. Tabs animate left-right on switch.

### Task 057 — Browse page search bar
Add a search input at the top right of browse page. Searches name + symbol against `/api/launches/search?q=`. Debounce 300ms. Shows results inline (not a new page).

### Task 058 — Browse page grid
Replace current empty grid with the real `TokenCard` component. Use CSS grid:
- Desktop: 4 columns
- Tablet: 2-3 columns
- Mobile: 1-2 columns
The grid has `card-stagger` class for entrance animation.

### Task 059 — Browse page pagination
Add "Load More" button at the bottom (not page numbers — infinite scroll feel). Uses `offset` param on the API. Shows "Showing X of Y tokens."

### Task 060 — Browse page empty state
When no launches exist: Show a large illustrated empty state with text "No launches yet. Be the first." and a "Launch a Token" CTA button.

### Task 061 — Browse page NFT tab
Add an "NFT" tab that switches to showing NftCard components from the `/api/nft-launches` endpoint. Same filter/sort system.

---

### TOKEN DETAIL PAGE (`/launch/[address]`)

This is the most complex and important page. Study the Dribbble screenshot carefully — it shows a trading terminal layout with chart on the left, buy panel on the right, and tabs for Comments/Transactions/Holders below.

### Task 062 — Detail page layout: two-column desktop
```
[LEFT COLUMN — 65% width]              [RIGHT COLUMN — 35% width]
┌─────────────────────────────┐        ┌─────────────────────────┐
│ Token header                │        │ Buy panel (glass card)  │
│ Name / TICKER  [socials]    │        │                         │
│ MC: ₿2.4 Liquidity: ₿1.8   │        │ [BTC Amount input]      │
│ Contract: 0x...             │        │                         │
├─────────────────────────────┤        │ You receive: ~X TOKEN   │
│ PRICE CHART (Recharts)      │        │ Min received: ~Y TOKEN  │
│ [1m] [5m] [1h] [1d]        │        │                         │
│                             │        │ [BUY NOW — orange btn]  │
│ Price chart here            │        │                         │
│                             │        │ Slippage: 1% [adjust]   │
├─────────────────────────────┤        ├─────────────────────────┤
│ BONDING CURVE               │        │ Token Info              │
│ Progress: ████████░ 72%     │        │ Creator: bc1q...        │
│ Current: 12,400 sats/token  │        │ Supply Cap: 21M         │
│ At 100%: 22,000 sats/token  │        │ Base Price: 1,000 sats  │
│ BTC Raised: ₿ 0.42         │        │ Increment: 100 sats     │
└─────────────────────────────┘        │                         │
                                       │ [Twitter] [TG] [Web]   │
[TABS: Comments | Transactions | Holders]└───────────────────────┘
```

Mobile: Stack vertically (buy panel first, then chart, then tabs).

### Task 063 — Token detail header
Show:
- Token image (80px circle, from IPFS if available, otherwise gradient fallback)
- Token name + ticker
- Inline social links (Twitter bird icon, Telegram paper plane icon, globe icon)
- Market cap + price (using `PriceDisplay` component with flash animation)
- "LIVE" badge if last trade < 60 seconds ago
- Contract address chip with copy button
- Blockscout link icon

### Task 064 — Price chart using Recharts
Create `frontend/src/components/charts/PriceChart.tsx`.

Fetch data from `/api/launches/:address/price-history`. Display as a custom-styled Recharts `AreaChart`:
- Background: transparent
- Grid lines: very subtle, `var(--bg-border)` color
- X-axis: time labels, IBM Plex Mono font
- Y-axis: price in sats, IBM Plex Mono font
- Area fill: gradient from orange (top) to transparent (bottom)
- Line stroke: `var(--orange-500)`, 2px width
- Tooltip: glass card style showing price + time + volume
- Timeframe tabs: 1h, 6h, 24h, 7d (changes the data window)

### Task 065 — Bonding curve visualization
Create `frontend/src/components/charts/BondingCurveViz.tsx`.

Show the mathematical bonding curve as a simple line chart:
- X axis: Supply sold (0 to supplyCap)
- Y axis: Price in sats
- Plot: `Price(s) = basePrice + s × priceIncrement` — a straight line
- Add a vertical marker at `currentSupply` position — "YOU ARE HERE"
- Shade the area already sold in orange, area remaining in dark
- Show key price points: start price, current price, end price (at cap)
This visualizes the bonding curve mechanism beautifully.

### Task 066 — Buy panel
Create `frontend/src/components/trading/BuyPanel.tsx`.

Features:
- BTC amount input with BTC icon
- Quick amount buttons: [0.001 BTC] [0.005 BTC] [0.01 BTC] [MAX]
- "You receive: ~X TOKEN" — calculated real-time using the contract's `calculateTokensForBTC` view function or the closed-form math `(basePrice, priceIncrement, currentSupply, btcAmount) => tokens`
- Slippage selector: [0.5%] [1%] [2%] [Custom] — collapsible
- Min tokens received = estimated × (1 - slippage)
- "BUY NOW" button (orange, full width, large)
- Transaction status display below button: shows the lifecycle states per PRD Section 9.9:
  ```
  ✓ Signed & Broadcast
  ⧖ BTC Mempool (0/1 confs)
  ⧖ Midl Execution
  ⧖ Finalized
  ```
  Each state animates in as it's reached.
- On success: confetti burst animation + "View on Explorer" link

### Task 067 — Transaction tabs: Comments
Below the chart/buy panel, add tab panel. Comments tab:
- Shows list of comments from `/api/launches/:address/comments`
- Comment input at top: text area + "Post Comment" button (requires wallet connection)
- Each comment shows: truncated address avatar (colored circle), address chip, comment text, time ago
- No sign-in needed — just wallet address
- Comments auto-refresh every 30 seconds

### Task 068 — Transaction tabs: Transactions
Shows trade history from `/api/launches/:address/purchases`:
```
[Account] [Type] [Amount (Token)] [BTC Paid] [Price] [Date] [BTC TX] [EVM TX]
```
- "BUY" badge in green, styled
- BTC TX links to `mempool.staging.midl.xyz/tx/...`
- EVM TX links to `blockscout.staging.midl.xyz/tx/...`
- Sorted newest first
- Paginated (20 per page)

### Task 069 — Transaction tabs: Holders
Show top holders from backend:
- Query unique buyers from Purchase table, aggregate token amounts
- Show rank (#1, #2, ...) + address + tokens held + % of supply

### Task 070 — Real-time activity feed on detail page (sidebar or below)
WebSocket-connected feed. When a new `tokens_purchased` event arrives for this specific launch, push it to the top of the feed as a new row with the `activity-item-new` animation. The feed shows: "🟢 bc1q...a3f4 bought 1,240 tokens for ₿0.003 · just now"

---

### CREATE TOKEN PAGE (`/create`)

### Task 071 — Create page multi-step layout
Convert the single-page form into a 3-step wizard with a progress indicator:

**Step 1: Token Identity**
- Token Name
- Token Symbol (ticker) — auto-uppercases, max 10 chars
- Description (textarea, 500 chars max)
- Image Upload (drag-and-drop zone or click to select, shows preview)
- Social Links: Twitter URL, Telegram URL, Website URL

**Step 2: Economics**
- Supply Cap (slider + number input, 1M-21M range, shows marks at 1M, 5M, 10M, 21M)
- Base Price (slider + number input, 1K-1M sats range)
- Price Increment (slider + number input)
- Creator Fee Rate (slider, 0-5%)
- Live preview: bonding curve visualization updates as sliders change
- Show "Price at 50% sold" and "Max price if sold out"

**Step 3: Review & Launch**
- Summary of all parameters
- Estimated gas fee warning
- "Launch Token" button (triggers the SDK flow)
- Pre-flight check: wallet connected? Has BTC balance? Shows these as checkboxes before enabling the button

### Task 072 — Image upload with IPFS
Create `frontend/src/lib/ipfs/upload.ts`:

```typescript
const PINATA_BASE = 'https://api.pinata.cloud';

export async function uploadImageToIPFS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pinataMetadata', JSON.stringify({ name: file.name }));
  formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

  const res = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: {
      pinata_api_key: process.env.NEXT_PUBLIC_PINATA_API_KEY!,
      pinata_secret_api_key: process.env.NEXT_PUBLIC_PINATA_SECRET!,
    },
    body: formData,
  });

  if (!res.ok) throw new Error(`Pinata upload failed: ${await res.text()}`);
  const data = await res.json();
  return data.IpfsHash;
}

export async function uploadMetadataToIPFS(metadata: {
  name: string; symbol: string; description: string;
  image: string; external_url?: string; twitter?: string; telegram?: string;
}): Promise<string> {
  const res = await fetch(`${PINATA_BASE}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: process.env.NEXT_PUBLIC_PINATA_API_KEY!,
      pinata_secret_api_key: process.env.NEXT_PUBLIC_PINATA_SECRET!,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: `${metadata.symbol}-metadata.json` },
    }),
  });

  if (!res.ok) throw new Error(`Pinata metadata upload failed`);
  const data = await res.json();
  return data.IpfsHash;
}

export const ipfsGateway = (cid: string) =>
  `https://gateway.pinata.cloud/ipfs/${cid}`;
```

### Task 073 — Create page: integrate IPFS upload
In the create flow, BEFORE calling `addTxIntentionAsync`:
1. Show "Uploading image to IPFS..." spinner
2. Upload image → get imageCID
3. Upload metadata JSON → get metadataCID
4. POST metadataCID + social fields to `/api/launches/:address/metadata` AFTER tx confirms (or speculatively before using the predicted contract address if calculable)
5. Pass metadataCID in the contract call or store it via the API

### Task 074 — Create page: Economics step with live bonding curve
The economics step shows a mini version of the `BondingCurveViz` component that updates live as the user adjusts sliders. This is visually spectacular and communicates the mechanism perfectly.

### Task 075 — Create page: transaction lifecycle display
After clicking "Launch Token", show the full transaction lifecycle in the Step 3 area:
```
[1] ⠋ Uploading to IPFS...             ✓ Done
[2] ⠋ Preparing transaction...          ✓ Done
[3] ⠋ Awaiting wallet signature...      ⠋ Waiting...
[4]   BTC Transaction broadcast...
[5]   Midl Execution...
[6]   Finalized
```
Each step animates in sequentially. Links to BTC mempool and Blockscout appear as each is confirmed.

---

### LAUNCH NFT PAGE (`/launch-nft`)

### Task 076 — Create /launch-nft route
New page: `frontend/src/app/launch-nft/page.tsx`

Same 3-step wizard pattern as token launch but for NFTs:

**Step 1: Collection Identity**
- Collection Name
- Symbol
- Description
- Collection Image (single cover image)
- Social links

**Step 2: Mint Parameters**
- Total Supply (100 - 10,000)
- Mint Price (in sats)
- Max per wallet (1-10)
- Reveal: Instant vs Delayed (toggle — delayed = placeholder image until revealed)

**Step 3: Review & Deploy**

Note: The NFT smart contract interaction will use a different contract (to be specified). For the hackathon, implement the UI fully but note in the UI if the NFT contract is not yet deployed (show "Coming Soon" state on the confirmation step if `NFT_FACTORY_ADDRESS` is not set).

---

### PORTFOLIO PAGE (`/portfolio`)

### Task 077 — Portfolio page layout
Two sections:
1. **Token Holdings** — table of tokens the connected wallet has bought
2. **NFT Holdings** — grid of NFTs owned (placeholder if none)

**Token holdings table:**
```
[Token] [Symbol] [Tokens Held] [Avg Buy] [Current Price] [P&L] [Value (BTC)]
[image] PEPBTC   1,240         12,400    14,200 sats      ↑14.5% ₿0.0176
```

**Summary cards at top:**
- Total Portfolio Value: ₿X.XX
- Total Invested: ₿X.XX  
- Unrealized P&L: ₿X.XX (+X%)
- Active Positions: X

### Task 078 — Portfolio activity tab
Second tab on portfolio: "My Activity" — shows all buys the connected wallet has made across all launches.

---

### TRANSACTIONS PAGE (`/transactions`)

### Task 079 — Transactions page redesign
This page shows the full transaction lifecycle for all transactions initiated from this browser session (stored in component state or localStorage).

Layout:
- Each transaction is a "Transaction Card" (glass card)
- Shows: Token name, action (Buy/Create), amount, BTC TX status, EVM TX status
- Lifecycle stages shown as a horizontal timeline:
  ```
  [Signed] ——●—— [BTC Mempool] ——●—— [Midl Executed] ——●—— [Finalized]
  ```
  Completed stages in orange, current stage pulsing, future stages muted.
- Links to mempool and blockscout for each stage
- "Your transaction will appear here" empty state when no transactions

---

## PHASE 5: IPFS + NEW FEATURES

### Task 080 — Token image display everywhere
After IPFS is integrated in create flow, update ALL places that show tokens to display the image:
- TokenCard component (main image area)
- Token detail page header (circular avatar)
- Browse page cards
- Portfolio table (small 32px icon)
- Activity feed (tiny 20px icon)
- Home page trending section

Fallback for tokens without images: deterministic gradient from token address.

### Task 081 — Dev buy option on create page
Add optional "Dev Buy" field in Step 2 of create form:
- "Buy X BTC worth at launch" — slider from 0 to 0.01 BTC
- Shows how many tokens they'd receive at base price
- This gets bundled with the create transaction or sent as an immediate second buy
- Toggle to enable/disable

### Task 082 — Search globally
Add search to the header (collapsible search bar that expands on click, keyboard shortcut ⌘K). Shows results from `/api/launches/search` in a dropdown overlay as user types.

### Task 083 — Token graduation celebration
When a token hits 100% supply sold (returned by WebSocket event `launch_finalized`), if the user is on that token's detail page:
- Show a confetti animation (use `canvas-confetti` package)
- Display a "🎉 Fully Subscribed!" banner
- The buy panel shows "This launch is complete" instead of the buy form
- The progress bar turns solid green

### Task 084 — Share/referral link
On token detail page, add a "Share" section in the right panel:
- Auto-generated URL: `midllaunch.xyz/launch/[address]?ref=[creatorAddress]`
- Copy button with feedback
- "Share on X" link that opens twitter.com/intent/tweet with pre-filled text

### Task 085 — Add token metadata to API
Ensure the backend API returns `imageUrl`, `description`, `twitterUrl`, `telegramUrl`, `websiteUrl` on all launch endpoints. The frontend displays these on token detail and on card hoverstates (tooltip with description).

---

## PHASE 6: RESPONSIVE + POLISH

### Task 086 — Mobile header (hamburger)
The hamburger menu slides in a full-height glass panel from the right. Contains:
- Connected wallet info
- All nav links
- Theme toggle
- Close button

### Task 087 — Mobile browse page
On mobile (< 768px):
- Single column grid
- Filter tabs scroll horizontally
- Larger card touch targets

### Task 088 — Mobile token detail page
Stack vertically:
1. Token header (full width)
2. BUY panel (full width, prominent)
3. Price chart (full width)
4. Bonding curve viz (full width, shorter)
5. Tabs (Comments/Txns/Holders)

Buy panel should have a sticky bottom behavior on mobile — stays at bottom of screen while scrolling, expandable.

### Task 089 — Mobile create page
The multi-step wizard works well on mobile — full width, step indicators as dots, swipeable (optional).

### Task 090 — Tablet layouts
At 768px-1024px:
- Browse: 2-3 column grid
- Detail: single column (same as mobile but wider)
- Create: 2-column in Step 2 (sliders left, preview right)

### Task 091 — Keyboard shortcuts
Add these keyboard shortcuts (shown in search/modal UI as hints):
- `/` — focus search
- `⌘K` — open search
- `Esc` — close modals/search
- `C` — navigate to create page (when not in an input)
- `B` — navigate to browse

### Task 092 — Loading skeletons
Replace all "loading..." text with skeleton screens that match the component layout. Use CSS animation:
```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
.skeleton {
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
```
Create skeleton versions of: TokenCard, DetailHeader, PriceChart placeholder, ActivityFeed.

### Task 093 — Error boundaries
Add React error boundaries around:
- The chart component (charts can crash if data is malformed)
- The WebSocket provider
- Each page
Show a friendly "Something went wrong" glass card with a retry button.

### Task 094 — Performance: image lazy loading
All token images use `loading="lazy"` and `next/image` with proper width/height. Set up `next.config.ts` to allow `gateway.pinata.cloud` as an allowed image domain.

### Task 095 — Final build verification
`cd frontend && npm run build` — MUST have zero errors. Verify bundle sizes are reasonable. Check all pages render without hydration errors.

### Task 096 — Verify mobile on simulated viewport
Use Chrome DevTools to verify every page at:
- 375px (iPhone SE)
- 768px (iPad)
- 1280px (Desktop)
Fix any layout issues.

### Task 097 — Add page transitions
Wrap the main content area with a simple fade-in transition on route change:
```css
@keyframes page-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.page-content { animation: page-enter 0.25s ease; }
```

### Task 098 — Final design audit
Walk through EVERY page in both dark mode and light mode. Check for:
- Text that's too small to read
- Buttons that are too small on mobile  
- Colors that don't have enough contrast
- Missing hover states
- Inconsistent spacing
Fix everything found.

### Task 099 — Accessibility minimum
- All interactive elements have visible focus states (`:focus-visible` with orange outline)
- All images have alt text
- All buttons have aria-labels if icon-only
- Color is not the only indicator (icons + text alongside color)

### Task 100 — Final documentation
Update `README.md` to reflect the actual current state: what works, how to run it, where the contracts are deployed, what the Xverse config fix was.

---

## DESIGN REFERENCE SUMMARY

From the Dribbble screenshots you've been shown, here's what to extract and apply:

**From the poo.fun clone screenshot (Image 1 — trading terminal):**
- Header with live ticker bar directly below it ✓
- Two-column layout: chart left, buy panel right ✓
- Tabs below the chart (Comments / Transactions / Holders) ✓
- Token name + pair (NAME / BTC equivalent) ✓
- Price metrics in header: Market Cap, Liquidity ✓
- Transaction table with color-coded Buy/Sell type ✓
- Share/referral section in buy panel ✓
- Token description in right panel ✓

**From the Gates crypto launchpad (Image 2 — premium dark glass):**
- Dark metallic/glass hero with large typography ✓
- Stats bar with numbers: Investors, Capital Raised, Projects ✓
- Navigation: minimal, top-aligned ✓
- Trust indicator (chain logos at bottom) ✓
- The chrome/metal curved shapes = we replicate with our bonding curve chart

**From the Shuttle/poo.fun design (Image 3 — NFT launchpad feel):**
- Large token/NFT image as card hero ✓
- Name + description overlay on card ✓
- Liquidity overlay panel (price range selector) = our Buy Panel ✓
- Horizontal navigation tabs across top ✓

---

## TECHNOLOGY CONSTRAINTS (DO NOT CHANGE)

- Frontend: Next.js 14, App Router, TypeScript, Tailwind CSS
- Web3: `@midl/core`, `@midl/react`, `@midl/executor-react`, `@midl/connectors`
- State: Zustand + React Query (tanstack-query)
- Charts: Recharts (already installed — use this, NOT an external charting library)
- Wallet: Xverse ONLY (no MetaMask, no RainbowKit)
- Backend: Express + Prisma + SQLite (dev) + Redis
- No external UI component libraries (Shadcn, Chakra, MUI, etc.) — custom components only
- IPFS: Pinata API (serverless, from frontend)
- Fonts: Syne + IBM Plex Mono + Manrope (via @fontsource, NOT Google Fonts CDN)

---

## FINAL INSTRUCTION TO AGENT

After completing all tasks, run a final checklist:

1. Does `npm run build` succeed with zero errors?
2. Does the Xverse connector have the correct `indexerUrl`?
3. Does the chain ID equal 15001?
4. Does the homepage show something visual even with no on-chain data (empty states)?
5. Does every page have a skeleton loading state?
6. Does every page render correctly on mobile (375px)?
7. Does the theme toggle work and persist?
8. Are all TypeScript types correct (no `any` types)?
9. Does the IPFS upload function exist and is it wired to the create form?
10. Is the Token Detail page the most visually impressive page?

If any of these fail, fix them before marking the project complete.

**The goal**: When a hackathon judge opens this app for the first time, they should immediately see something that feels like a real product — not a demo, not a prototype. The visual quality should make them say "wait, this is actually good." The working Xverse wallet connection + real transaction on Midl staging network is the proof of technical completeness. The design is what makes it unforgettable.

Good luck. Build something extraordinary.
