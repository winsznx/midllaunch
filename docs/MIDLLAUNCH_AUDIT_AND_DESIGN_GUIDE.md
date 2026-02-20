# MidlLaunch — Full Audit Prompt + Design Overhaul Guide

---

## PART 1: INTEGRATION AUDIT PROMPT
> Paste this verbatim into Claude Code to get a structured fix list

---

```
You are auditing the MidlLaunch codebase — a Bitcoin-native token launchpad built on 
Midl's EVM execution layer. Read every file in the project and produce a categorized 
audit covering all 5 domains below. For each issue found, provide:
  - File path + line number(s) affected
  - What's broken or suboptimal
  - Exact fix (code snippet where possible)
  - Severity: CRITICAL / HIGH / MEDIUM / LOW

=== DOMAIN 1: XVERSE WALLET + MIDL SDK INTEGRATION ===

Audit these specific areas:

1. xverseConnector() configuration — check if indexerUrl is set to 
   "https://api-regtest-midl.xverse.app/" (not mempool.staging.midl.xyz). 
   This is the known PSBT signing bug that causes "No selected UTXOs."

2. WagmiMidlProvider config — verify chain ID is 15001 (Midl staging), 
   not 1001 or any other value.

3. midlConfig testnet network — confirm @midl/core `testnet` export 
   resolves to chain ID 15001. If it resolves differently, we need to 
   use a custom network definition.

4. Transaction flow in create/page.tsx — verify the order is:
   addTxIntentionAsync → finalizeBTCTransactionAsync → signIntentionAsync → 
   sendBTCTransactionsAsync. Flag any deviation.

5. Transaction flow in launch/[address]/page.tsx — same verification for buy flow.

6. useAccounts() hook — confirm paymentAccount filtering by AddressPurpose.Payment 
   is correct. Check if Xverse returns multiple account types and we're selecting wrong one.

7. LaunchFactory ABI — verify frontend/src/lib/contracts/LaunchFactory.abi.json 
   exists and is populated. Check if LAUNCH_FACTORY_ADDRESS is a real deployed 
   address or still the placeholder 0x5FbDB2315678afecb367f032d93F642f64180aa3.

8. BondingCurvePrimaryMarket ABI — same check for 
   frontend/src/lib/contracts/BondingCurvePrimaryMarket.abi.json.

9. Environment variables — check frontend/.env.local for:
   - NEXT_PUBLIC_MIDL_RPC_URL set to https://rpc.staging.midl.xyz
   - NEXT_PUBLIC_LAUNCH_FACTORY_ADDRESS set
   - NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL set and pointing to correct ports

10. CORS — check backend/.env for CORS_ORIGIN matching the exact port frontend 
    is running on (3000 vs 3002 vs 3003).

=== DOMAIN 2: SMART CONTRACT INTEGRITY ===

1. LaunchFactory.sol — verify createLaunch() function signature matches 
   exactly what the frontend is encoding with encodeFunctionData(). 
   Check parameter order: intentId, name, symbol, supplyCap, basePrice, 
   priceIncrement, creatorFeeRate, executionMode, modeMetadata.

2. BondingCurvePrimaryMarket.sol — verify buy() function signature and 
   parameters match what the buy flow is encoding. Check minTokensOut 
   parameter is being passed correctly.

3. Hardhat config — confirm network settings for Midl staging: 
   chainId 15001, correct RPC URL. Check deploy.ts script is targeting 
   the right network.

4. Contract constructor parameters — verify no hardcoded values that 
   differ between local Hardhat and Midl staging.

5. Events — confirm LaunchCreated and TokensPurchased events include 
   intentId field (required by indexer for correlation).

=== DOMAIN 3: BACKEND INDEXER + API ===

1. Indexer SSL errors — in backend/src/indexer/index.ts, check if there's 
   retry logic with exponential backoff for ERR_SSL_SSLV3_ALERT_BAD_RECORD_MAC.
   If not, add it. The indexer should not crash on SSL errors, it should retry.

2. Contract address in indexer — check what address the indexer is listening 
   to. If LAUNCH_FACTORY_ADDRESS is still the placeholder, it will never index 
   real events. Must match the actually-deployed factory address.

3. Event ABI in indexer — confirm the indexer is using the correct event 
   signatures for LaunchCreated, TokensPurchased, LaunchFinalized. 
   Check field names match PRD Section 13 schema including intentId.

4. Redis dependency — check if Redis is actually available or if the indexer 
   silently fails when Redis is not running. Add graceful degradation.

5. API pagination — verify /api/launches supports limit, offset, sortBy, 
   filter parameters. Check the SQL queries are using these correctly.

6. WebSocket broadcasting — confirm the WebSocket server is correctly 
   forwarding Redis pub/sub messages to subscribed clients.

7. Database schema — check if Launch table has columns for: tokenAddress, 
   curveAddress, name, symbol, supplyCap, basePrice, priceIncrement, 
   creatorFeeRate, totalSupplySold, totalBTCDepositedSats, isFinalized, 
   createdAt, intentId. Flag any missing columns.

=== DOMAIN 4: FRONTEND DATA FLOW ===

1. useLaunches hook — check React Query setup. Is it fetching from the 
   correct API URL? Is it properly typing the response? Are loading/error 
   states handled?

2. Empty state rendering — the homepage shows empty launch cards (dark squares). 
   Is this because: (a) API returns empty array, (b) API call failing due to CORS, 
   or (c) data exists but component not mapping it? Diagnose the exact cause.

3. Launch detail page — check if launch data, purchase history, and bonding 
   curve state are all being fetched. Verify price calculation from current 
   supply is correct: Price(s) = basePrice + (s × priceIncrement).

4. WebSocket client — verify frontend/src/lib/websocket/client.ts connects 
   to the correct WS_URL. Check message handler updates React Query cache 
   on new events rather than requiring page refresh.

5. Portfolio page — check if it's fetching /api/user/:address/holdings with 
   the connected wallet's payment address. Verify address format (BTC vs EVM).

6. Transaction page — verify it's pulling transaction state from correct source.
   Check that transaction lifecycle states (Signed → BTC Included → Midl Executed 
   → Finalized) are being displayed per PRD Section 9.9.

=== DOMAIN 5: MISSING FEATURES FOR COMPETITIVE PARITY ===

Identify which of these are NOT implemented and output a prioritized build list:

1. Token image upload on create form (IPFS via Pinata)
2. Token description field on create form  
3. Social links fields (Twitter, Telegram, Website) on create form
4. Image display on launch cards in browse page
5. Bonding curve progress bar on launch cards (% toward supply cap)
6. Market cap display on launch cards
7. Price change % on launch cards
8. Live activity feed on launch detail page (real-time buys streaming in)
9. Bonding curve visualization / price chart on launch detail page
10. Sort/filter tabs on browse page: New, Trending, Market Cap, Last Trade
11. Search functionality on browse page
12. "Dev buy" option on create form (buy first X tokens at creation)
13. Creator profile on launch detail page
14. Comment/reply thread on launch detail page
15. Token graduation threshold indicator (% to supply cap fill)

For each missing feature, estimate implementation complexity: HOURS / DAYS.

Output the full audit as a numbered list grouped by domain, 
with total issue count per domain at the end.
```

---

## PART 2: THE REDESIGN — What Your UI Needs to Become

### What Your Current UI Communicates vs. What It Should

| Your Current UI | Pump.fun / Target |
|---|---|
| Empty dark cards in a grid | Token images FILL the card — it's a media wall |
| "Recent Launches" header | Live ticker + trending badges |
| DM Sans font | Custom display font with personality |
| Static layout | Micro-animations — price pulses green/red on update |
| Single orange accent | Multi-temperature palette: BTC orange + hot green + loss red + warm cream |
| Trust disclaimer banner at top | Trust info in footer — above fold is pure discovery |
| CTA buttons look identical | Primary action is vivid, secondary is ghost-style |
| No token images | Every card = token image + overlay data |

---

### The Font Problem (Most Visible Fix)

Your app currently uses either Inter or DM Sans — the two most AI-generated fonts in existence. Here's what to use instead:

**Display / Headers**: `Space Mono` (monospaced, crypto-terminal feel) or `Barlow Condensed` (dense, bold, tabloid energy) or `Syne` (geometric, forward)

**Body text**: `IBM Plex Mono` for numbers/addresses (pairs beautifully with any display font) + `Manrope` for descriptions

**Numbers specifically**: Always use tabular-nums. Crypto prices jitter when digits change width.

In your `globals.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400;500;600&display=swap');

:root {
  --font-display: 'Syne', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
  --font-body: 'Manrope', sans-serif;
}

/* CRITICAL — tabular numbers for all prices/counts */
.font-num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

---

### The Color System Overhaul

Pump.fun isn't actually using green/purple — it's using a **neutral dark base** with **image-driven color**. The cards glow because of the token images. Your app has no images yet, so you compensate with a richer palette.

```css
:root {
  /* Base — warm dark, not cold black */
  --bg-base: #0d0c0b;        /* warm almost-black */
  --bg-surface: #161412;     /* card background */
  --bg-elevated: #1e1b18;    /* hover state / modal */
  --bg-border: #2a2520;      /* borders */

  /* BTC Orange — your brand, use sparingly */
  --orange-500: #f97316;
  --orange-400: #fb923c;
  --orange-glow: rgba(249, 115, 22, 0.15);

  /* Green = positive, up, live */
  --green-500: #22c55e;
  --green-dim: rgba(34, 197, 94, 0.12);

  /* Red = negative, down, danger */
  --red-500: #ef4444;
  --red-dim: rgba(239, 68, 68, 0.12);

  /* Text hierarchy */
  --text-primary: #f5f0e8;   /* warm white, not pure white */
  --text-secondary: #a89880;  /* warm muted */
  --text-tertiary: #6b5e52;   /* very muted */

  /* Satoshi gold for special elements */
  --gold: #f5c842;
}
```

---

### The Launch Card — The Single Most Important Component

This is where pump.fun wins. Each card is NOT a card — it's a **thumbnail + data overlay**. Here's the architecture:

```
┌──────────────────────────────────┐
│  [TOKEN IMAGE — fills entire     │  ← 200px tall image, object-cover
│   card top 55%]                  │
│                        🔴 LIVE   │  ← badge, top-right
├──────────────────────────────────│
│  🟠 PEPE BITCOIN  •  PEPBTC      │  ← name + ticker, bold
│  MC $2.4M  ↑ 34.2%              │  ← market cap + change (green/red)
│  ████████░░░░░  61%              │  ← progress bar toward graduation
│  by bc1q…ab3f  • 2m ago         │  ← creator address + time
└──────────────────────────────────┘
```

Key details:
- Progress bar color shifts from orange (0%) → yellow (50%) → green (near 100%)
- Price change blinks/pulses on update (CSS animation, 300ms)
- "LIVE" badge if there was a trade in last 60 seconds
- Hover: slight scale(1.02) + orange border glow appears
- No token image yet? Use a generated gradient based on token name hash as placeholder

---

### The Browse Page — Tabs That Matter

Replace your current browse page structure with:

```
[🔥 Trending] [🆕 New] [📈 Market Cap] [⚡ Last Trade] [🎓 Near Graduation]
                                                         Filter ⊞ ≡
```

Each tab is a different `sortBy` query param to your API. The "Near Graduation" tab is a specific filter: tokens at 70%+ supply cap fill. This is your highest-urgency tab — it creates FOMO.

---

### The Homepage Hero — Kill the Trust Disclaimer

Right now your first visual is a warning box. That's a conversion killer. Move trust info to the footer. Your above-fold should be:

```
[LIVE TICKER — scrolling marquee of recent buys: "wallet bought 1,240 PEPBTC for 0.003 BTC" — scrolls right to left]

        Bitcoin Token Launches
   The first bonding curve launchpad on Bitcoin L2.
   [Browse Tokens →]    [Launch a Token →]

[3 FEATURED TOKENS — big cards with real images]
```

The live ticker is a single CSS marquee animation fed by WebSocket. It makes the page feel alive even with 5 total launches.

---

### Light Mode — Do It Properly

Your current dark mode is fine. Light mode needs to feel warm, not sterile. Pump.fun doesn't have a proper light mode — this is a differentiator.

```css
[data-theme="light"] {
  --bg-base: #faf7f2;        /* warm cream, not white */
  --bg-surface: #f0ebe2;
  --bg-elevated: #e8e0d4;
  --bg-border: #d4c9bb;
  --text-primary: #1a1410;
  --text-secondary: #5c4f42;
  --text-tertiary: #9c8f82;
  /* Orange stays the same — it pops on cream beautifully */
}
```

Light mode toggle: store in localStorage, apply `data-theme` attribute to `<html>`. Use a sun/moon icon, not a toggle switch (toggle switches are AI slop).

---

### Micro-Interactions Checklist

These are the things that make it feel alive, each is 10-30 lines of CSS:

```
[ ] Price numbers: pulse green flash on increase, red flash on decrease
    → CSS animation: @keyframes priceUp { 0% { color: var(--green-500); } 100% { color: inherit; } }

[ ] Launch cards on browse: stagger-animate in on page load
    → animation-delay: calc(var(--index) * 60ms) on each card

[ ] Buy/Create button: shimmer sweep effect on hover (not a gradient, a light sweep)
    → ::after pseudo-element with translateX animation

[ ] Progress bar: animate fill width on load with ease-out
    → transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)

[ ] Live activity feed on detail page: new items slide in from bottom
    → @keyframes slideInUp with transform: translateY(20px) → translateY(0)

[ ] Address chips: truncated with fade mask on right edge (not ellipsis)
    → mask-image: linear-gradient(to right, black 80%, transparent 100%)

[ ] Wallet connect button: subtle pulse ring when not connected
    → @keyframes ring: box-shadow grows and fades, 2s infinite
```

---

## PART 3: FEATURES TO ADD (Priority Order)

### Phase A — Unblocking (Do This Weekend)
1. **UTXO Fix**: `indexerUrl: "https://api-regtest-midl.xverse.app/"` in xverseConnector
2. **Deploy real contract**: Get testnet BTC, `npm run deploy:staging`, update factory address
3. **Create one real token**: End-to-end proof you can show

### Phase B — Visual Upgrade (This Week)
4. **Font swap**: Syne + IBM Plex Mono. 30 minutes of CSS changes.
5. **Color system**: Apply warm dark palette and text hierarchy above
6. **Launch card redesign**: Image placeholder (gradient fallback) + overlay data
7. **Kill the trust disclaimer from hero**: Move to footer
8. **Live ticker marquee**: WebSocket-fed, CSS scroll animation

### Phase C — Feature Depth (Next 3-4 Days)
9. **IPFS image upload**: Pinata integration on create form
10. **Token metadata**: Description + social links on create form + detail page
11. **Sort/filter tabs**: New, Trending, Market Cap, Near Graduation
12. **Live activity feed**: Real-time buy stream on detail page
13. **Bonding curve chart**: Price vs. supply using Recharts (already installed)
14. **Progress bar with graduation threshold**: On every card + detail page
15. **Search**: Simple name/ticker filter against API

### Phase D — Differentiators (If Time Allows)
16. **Comment thread on token page**: Firebase Realtime or your own backend (add comments table)
17. **Dev buy on create**: Creator can optionally buy first N tokens at launch
18. **Trending algorithm**: Score = (volume last 1h × 0.4) + (buyers last 1h × 0.3) + (recency × 0.3)
19. **Token graduation celebrations**: Confetti when a token hits 100% — pure dopamine

---

## PART 4: IPFS INTEGRATION — Implementation Blueprint

```typescript
// frontend/src/lib/ipfs/upload.ts

const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY!;
const PINATA_SECRET = process.env.NEXT_PUBLIC_PINATA_SECRET!;
const PINATA_BASE = 'https://api.pinata.cloud';

// Step 1: Upload image file → returns image CID
export async function uploadImageToIPFS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pinataMetadata', JSON.stringify({ name: file.name }));
  formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

  const res = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: {
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET,
    },
    body: formData,
  });

  if (!res.ok) throw new Error('Image upload failed');
  const { IpfsHash } = await res.json();
  return IpfsHash; // "QmXxx..."
}

// Step 2: Upload metadata JSON → returns metadata CID
export async function uploadMetadataToIPFS(metadata: {
  name: string;
  symbol: string;
  description: string;
  image: string; // "ipfs://QmXxx..."
  external_url?: string;
  twitter?: string;
  telegram?: string;
}): Promise<string> {
  const res = await fetch(`${PINATA_BASE}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: `${metadata.symbol}-metadata` },
    }),
  });

  if (!res.ok) throw new Error('Metadata upload failed');
  const { IpfsHash } = await res.json();
  return IpfsHash;
}

// Helper to get gateway URL
export function ipfsToHttp(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}
```

**In your create form**: Before calling `addTxIntentionAsync`, run:
```typescript
const imageCID = await uploadImageToIPFS(imageFile);
const metadataCID = await uploadMetadataToIPFS({
  name: formData.name,
  symbol: formData.symbol,
  description: formData.description,
  image: `ipfs://${imageCID}`,
  twitter: formData.twitter,
  telegram: formData.telegram,
});
// Store metadataCID in your backend alongside the launch
// Pass it as part of the create transaction or emit it in the event
```

**In your backend**: Add `metadataCID` column to Launch table. When indexing LaunchCreated events, the metadataCID won't be on-chain (unless you added it to the contract) — so you need a side-channel: store it in your backend when the user submits the form, before the tx confirms.

---

## PART 5: THE COMPETITIVE SUMMARY

What Axis (your competition) has:
- ✅ Working on-chain deployment (they fixed UTXO bug)
- ✅ AI-powered token name generation (gimmick but judges like it)
- ✅ Brutalist UI (distinctive, not AI-default)
- ❌ No browse/discovery page
- ❌ No buy flow
- ❌ No token images
- ❌ No price charts
- ❌ No activity feeds
- ❌ No portfolio
- ❌ No real-time anything

What you have that they don't:
- ✅ Full backend with API + WebSocket
- ✅ Browse page (needs data)
- ✅ Buy flow (needs UTXO fix)
- ✅ Portfolio page
- ✅ Transaction history page
- ✅ Launch detail page with all sections
- ✅ More complete PRD implementation

**Your one-line pitch vs theirs:**
- Axis: "We can deploy a token"
- MidlLaunch (after fixes): "We are the pump.fun of Bitcoin L2 — deploy, discover, trade"

The judges know what a launchpad is supposed to be. Show them the whole product.
