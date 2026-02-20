# Task Plan: MidlLaunch — Full Gap Fill (AGENT_PROMPT.md → 100%)

## Goal
Close every gap between `AGENT_PROMPT.md` (the full 100-task spec) and the current codebase.
`IMPLEMENT_NOW.md` Batches A–H are done. This plan covers everything AGENT_PROMPT.md specified
that IMPLEMENT_NOW.md never mentioned, plus wiring issues where components exist but aren't connected.

## Build Checkpoints
Run `npm run build` (frontend) + `npx tsc --noEmit` (backend) after each phase.

---

## PHASE 1 — Backend Gaps

### 1.1 `GET /api/launches/trending` dedicated endpoint
File: `backend/src/api/index.ts`
Place BEFORE `/:tokenAddress` wildcard.
Scoring: fetch last-1h purchases per launch, compute:
  `score = (volumeLast1h_sats × 0.4) + (uniqueBuyersLast1h × 0.3 × 1e8) + (recencyScore × 0.3 × 1e8)`
  where `recencyScore = 1 / (secondsSinceLastTrade + 1) × 1e6`
Return top 10 launches sorted by score descending.
Response: `{ launches: Launch[] }`

### 1.2 `GET /api/launches/:address/price-history` endpoint
File: `backend/src/api/index.ts`
Query Purchase table for this launch, ordered by timestamp ASC.
Each row becomes: `{ timestamp: number (ms), price: string (wei), supply: string (base units) }`
Price per row = `basePrice + (tokenAmount_cumulative × priceIncrement)` — derive from launch params.
Return: `{ history: { timestamp: number, price: string, supply: string }[] }`

### 1.3 WebSocket `nft_minted` broadcast
File: `backend/src/api/index.ts` (in PATCH /api/nft-launches/:address/metadata or a separate trigger)
When an NftMint record is created via the API, broadcast:
```json
{ "type": "nft_minted", "data": { "collectionAddress": "...", "tokenId": N, "buyerAddress": "...", "pricePaidSats": "..." } }
```
Pattern identical to the existing `tokens_purchased` broadcast.

### 1.4 Zod request validation on POST/PATCH endpoints
Install: `cd backend && npm install zod`
Add validation to:
- `POST /api/launches/:address/comments` — body: `{ author: z.string(), body: z.string().min(1).max(500) }`
- `PATCH /api/launches/:address/metadata` — body: partial schema, all string fields
- `POST /api/nft-launches` (if exists) — validate required fields
Return `400` with `{ error: string }` on failure.

---

## PHASE 2 — Toast Notification System

### 2.1 Install and configure react-hot-toast
`cd frontend && npm install react-hot-toast`
In `frontend/src/app/layout.tsx`, add `<Toaster>` with custom glass style:
```tsx
<Toaster
  position="bottom-right"
  toastOptions={{
    style: {
      background: 'var(--bg-elevated)',
      border: '1px solid var(--bg-border)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-body)',
      fontSize: '13px',
    },
    success: { iconTheme: { primary: 'var(--green-500)', secondary: 'var(--bg-elevated)' } },
    error:   { iconTheme: { primary: 'var(--red-500)',   secondary: 'var(--bg-elevated)' } },
  }}
/>
```

### 2.2 Wire toasts to wallet events
File: `frontend/src/components/layout/Header.tsx`
- On connect success: `toast.success('Wallet connected')`
- On connect error: `toast.error(err.message)`
- On disconnect: `toast('Disconnected', { icon: '👋' })`

### 2.3 Wire toasts to buy flow
File: `frontend/src/app/launch/[address]/page.tsx` (buy handler)
- After `sendBTCTransactionsAsync` succeeds: `toast.success('Buy submitted — awaiting BTC confirmation')`
- On catch: `toast.error(err.message.slice(0, 80))`

### 2.4 Wire toasts to create flow
File: `frontend/src/app/create/page.tsx`
- On launch success: `toast.success('Token launched!')`
- On error: `toast.error(err.message.slice(0, 80))`

### 2.5 Wire toast to AddressChip copy
File: `frontend/src/components/ui/AddressChip.tsx`
Replace `setCopied(true)` side-effect with `toast.success('Copied!')` (keep the copied state for the button label).

---

## PHASE 3 — Landing Page: Recent Activity List

### 3.1 Add "Recent Activity" list section to home page
File: `frontend/src/app/page.tsx`
Position: between "Trending Now" and "NFT Launches" sections.
Fetch from `/api/activity` (already exists). Show last 10 events as a styled list:
```
[●] bc1q…a3f4   bought 1,240 PEPBTC   for ₿ 0.003   · 2m ago
[●] bc1q…x7d2   launched DOGEBTC                     · 5m ago
```
- Green dot for buy events
- Orange dot for launch events
- Address truncated with font-mono
- "View all activity →" link placeholder (no page needed, just styled)
- Skeleton: 10-row ActivityFeedSkeleton while loading

---

## PHASE 4 — Browse Page: NFT Tab

### 4.1 Add NFT tab to browse page
File: `frontend/src/app/launches/page.tsx`
Add a 6th tab: `{ label: 'NFT', icon: '🖼', sort: 'newest', mode: 'nft' }` (add `mode` field to TABS type).
When `mode === 'nft'`, fetch from `/api/nft-launches?limit=60` instead of `/api/launches`.
Render `NftCard` components instead of `TokenCard`.
Skeleton: same `TokenCardSkeleton` grid while loading.
Empty state: "No NFT launches yet. Be the first." + "Launch NFT" CTA.

---

## PHASE 5 — Token Detail Page Upgrades

### 5.1 Wire PriceChart to price-history data
File: `frontend/src/app/launch/[address]/page.tsx`
Add a `usePriceHistory(address, timeframe)` hook in `useLaunches.ts` that fetches `/api/launches/:address/price-history`.
Add state: `const [chartTimeframe, setChartTimeframe] = useState<'1h'|'6h'|'24h'|'7d'>('24h')`
Filter the history data client-side by timeframe window.
Replace the inline `BondingCurveChart` section with TWO tabs above it:
  - "Price Chart" tab → renders `<PriceChart data={filteredHistory} timeframe={chartTimeframe} onTimeframeChange={setChartTimeframe} />`
  - "Bonding Curve" tab → renders existing `<BondingCurveChart>` (keep as-is, just tab-switch)
Both tabs in the same glass card container.

### 5.2 Replace inline buy widget with BuyPanel component
File: `frontend/src/app/launch/[address]/page.tsx`
The inline buy form (lines ~843–983) should be replaced with:
`<BuyPanel launch={launch} onSuccess={() => { refetch(); refetchPurchases(); }} />`
The BuyPanel component already exists at `frontend/src/components/trading/BuyPanel.tsx`.
Remove the duplicate inline state: `btcAmount`, `slippage`, `isBuying`, `buyError`, `estimatedTokens`, `estimateTimer`, `handleBuy`.
Keep `paymentAccount` check — pass it to BuyPanel or let BuyPanel use the hook internally.

### 5.3 Token detail header: social links
File: `frontend/src/app/launch/[address]/page.tsx`
In the header section (after the name/ticker row), add social links row when any of `launch.twitterUrl`, `launch.telegramUrl`, `launch.websiteUrl` are set:
```tsx
<div className="flex items-center gap-2 mt-1">
  {launch.twitterUrl && (
    <a href={launch.twitterUrl} target="_blank" rel="noopener noreferrer"
       className="w-6 h-6 rounded flex items-center justify-center hover:opacity-70 transition-opacity"
       style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
       aria-label="Twitter">
      {/* Twitter bird SVG 12×12 */}
    </a>
  )}
  {launch.telegramUrl && ( /* Telegram paper-plane SVG */ )}
  {launch.websiteUrl && ( /* Globe SVG */ )}
</div>
```

### 5.4 Token detail header: MC + Liquidity stats
File: `frontend/src/app/launch/[address]/page.tsx`
Below the address chips, add a small stats row:
```tsx
<div className="flex items-center gap-4 mt-2 text-xs">
  <span style={{ color: 'var(--text-tertiary)' }}>
    MC: <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
      ₿ {formatBTC(String(BigInt(launch.currentPrice ?? '0') * BigInt(launch.currentSupply ?? '0') / TOKEN_BASE))}
    </span>
  </span>
  <span style={{ color: 'var(--text-tertiary)' }}>
    Raised: <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
      ₿ {formatBTC(launch.totalBTCDeposited ?? '0')}
    </span>
  </span>
</div>
```

### 5.5 Token detail header: AddressChip for contract addresses
File: `frontend/src/app/launch/[address]/page.tsx`
In the "Contract Addresses" section (currently uses raw `<code>`), replace with:
`<AddressChip address={addr} />` + existing `<a href={blockscout}>↗</a>`

### 5.6 Transaction tab: full table with BTC/EVM TX links
File: `frontend/src/app/launch/[address]/page.tsx` — inside `DetailTabs`
The "Transactions" tab currently shows `<ActivityFeed>` (just buyer + token amount).
Upgrade to a full table:
```
[Address] [Tokens] [BTC Paid] [Time] [BTC TX ↗] [EVM TX ↗]
```
- "BUY" badge in green
- BTC TX → `https://mempool.staging.midl.xyz/tx/${purchase.btcTxHash}` (if available)
- EVM TX → `https://blockscout.staging.midl.xyz/tx/${purchase.txHash}` (if available)
- If no hash available, show "—"
Keep mobile-friendly: on narrow screens stack columns or use overflow-x-auto.

### 5.7 Wire DetailHeaderSkeleton and ActivityFeedSkeleton
File: `frontend/src/app/launch/[address]/page.tsx`
The loading state (lines ~608–623) currently uses raw inline skeleton divs.
Replace with:
```tsx
import { DetailHeaderSkeleton, ActivityFeedSkeleton } from '@/components/ui/Skeletons';
// In loading state:
<DetailHeaderSkeleton />
// In Transactions tab while loading:
<ActivityFeedSkeleton />
```

### 5.8 Token graduation: canvas-confetti
File: `frontend/src/app/launch/[address]/page.tsx`
Install: `cd frontend && npm install canvas-confetti @types/canvas-confetti`
Add to the WebSocket `handlePurchase` handler:
```tsx
import confetti from 'canvas-confetti';
// After refetch() in handlePurchase, check if progress just hit 100%:
if (data && Number(BigInt(data.currentSupply) * BigInt(100) / BigInt(data.supplyCap)) >= 100) {
  confetti({ particleCount: 120, spread: 80, colors: ['#f97316', '#22c55e', '#ffffff'] });
}
```
Also: when `launch.status !== 'ACTIVE'` (graduated), render "🎉 Fully Subscribed!" banner above the sidebar.

---

## PHASE 6 — Portfolio Page Upgrades

### 6.1 Display P&L columns in portfolio table
File: `frontend/src/app/portfolio/page.tsx`
The API already returns `avgBuyPriceSats`, `currentPriceSats`, `unrealizedPnlSats`, `unrealizedPnlPct`.
Add these columns to the holdings table:
```
[Token] [Symbol] [Tokens Held] [Avg Buy] [Current Price] [Unrealized P&L] [Value (BTC)]
```
P&L cell:
- Green with ↑ if positive, red with ↓ if negative
- Format: `+14.5%` or `−3.2%`
- Sub-text: `₿ 0.0012` absolute amount
Summary cards at top (if not already there):
- "Total Portfolio Value", "Total Invested", "Unrealized P&L", "Active Positions"

### 6.2 "My Activity" tab on portfolio
File: `frontend/src/app/portfolio/page.tsx`
Add a second tab: "Holdings" (existing table) | "My Activity" (new tab).
"My Activity" tab fetches `/api/user/:address/purchases` (or reuse usePurchases with no address filter).
Display in the same full-table format as the detail page Transaction tab (see 5.6):
`[Token] [Tokens] [BTC Paid] [Time] [BTC TX ↗] [EVM TX ↗]`

---

## PHASE 7 — Global Search + Keyboard Shortcuts

### 7.1 Collapsible search bar in Header
File: `frontend/src/components/layout/Header.tsx`
Add state: `const [searchOpen, setSearchOpen] = useState(false)`
Add state: `const [searchQuery, setSearchQuery] = useState('')`
Add state: `const [searchResults, setSearchResults] = useState<Launch[]>([])`
Desktop: icon button (magnifying glass SVG) in the right-side controls. On click, expands to an input inline.
Mobile: not shown in header (search accessible via browse page).

### 7.2 Search results dropdown
File: `frontend/src/components/layout/Header.tsx`
Debounced fetch (300ms) to `/api/launches/search?q=${query}` when query.length >= 2.
Results dropdown: absolute positioned below search bar, `z-50`, glass background.
Each result row: token gradient circle + name + ticker + price. Click → navigate to `/launch/${address}`.
Shows max 5 results. "View all results →" link to `/launches?q=${query}` at bottom.
Close on: `Esc` key, click outside (click-away listener), route change.

### 7.3 ⌘K keyboard shortcut to open search
File: `frontend/src/components/layout/Header.tsx`
```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
    if (e.key === 'Escape') setSearchOpen(false);
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```
Show hint in the search input placeholder: "Search... ⌘K"

### 7.4 Page-level keyboard shortcuts
File: `frontend/src/app/layout.tsx`
Add a global keydown listener that fires only when `document.activeElement` is `<body>` (not in an input/textarea):
```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    if (e.key === '/' || (e.metaKey && e.key === 'k')) {
      e.preventDefault();
      // dispatch custom event to open search
      window.dispatchEvent(new CustomEvent('open-search'));
    }
    if (e.key === 'c' || e.key === 'C') router.push('/create');
    if (e.key === 'b' || e.key === 'B') router.push('/launches');
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [router]);
```
Header listens for `open-search` custom event to open the search bar.

---

## PHASE 8 — next/image Migration

### 8.1 Add pinata gateway to next.config.ts
File: `frontend/next.config.ts`
```ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'gateway.pinata.cloud' },
    { protocol: 'https', hostname: '*.ipfs.nftstorage.link' },
  ],
},
```

### 8.2 Replace <img> in TokenCard.tsx
File: `frontend/src/components/ui/TokenCard.tsx`
`import Image from 'next/image'`
Replace `<img src={imageUrl} ...>` with:
`<Image src={imageUrl} alt={launch.name} fill className="object-cover" />`
Wrap in `<div className="relative w-full h-full">` (Image with fill needs relative parent with explicit size).

### 8.3 Replace <img> in NftCard.tsx
File: `frontend/src/components/tokens/NftCard.tsx`
Same pattern as 8.2.

### 8.4 Replace <img> in launch/[address]/page.tsx
File: `frontend/src/app/launch/[address]/page.tsx`
Line ~681: `<img src={imageUrl} alt={launch.name} className="w-full h-full object-cover" />`
→ `<Image src={imageUrl} alt={launch.name} fill className="object-cover" />`
Parent div needs `position: relative`.

### 8.5 Replace <img> in create/page.tsx (×2)
File: `frontend/src/app/create/page.tsx`
Both image preview `<img>` tags → `<Image>` with explicit width/height from the preview state dimensions,
or use `fill` in a fixed-size relative wrapper.

### 8.6 Replace <img> in launch-nft/page.tsx
File: `frontend/src/app/launch-nft/page.tsx`
Same as 8.5.

---

## PHASE 9 — Polish, Mobile, Accessibility

### 9.1 Page transition animation
File: `frontend/src/app/globals.css` + `frontend/src/app/layout.tsx`
Add to globals.css:
```css
@keyframes page-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.page-content { animation: page-enter 0.25s ease; }
```
In `layout.tsx`, add `key={pathname}` to the main content wrapper so Next.js re-mounts on route change:
```tsx
<main key={pathname} className="page-content min-h-screen">
  {children}
</main>
```

### 9.2 Focus-visible accessibility styles
File: `frontend/src/app/globals.css`
Add:
```css
:focus-visible {
  outline: 2px solid var(--orange-500);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
/* Remove default outline, rely only on focus-visible */
:focus:not(:focus-visible) { outline: none; }
```

### 9.3 Aria-labels on icon-only buttons
Files: Header.tsx (theme toggle, search icon), MobileMenu.tsx (hamburger, close button), AddressChip.tsx
Verify every button with no text has `aria-label="..."`.
Add `aria-label` to: theme toggle (already has it ✓), mobile hamburger (has it ✓), search button (NEW), close search button (NEW).

### 9.4 Alt text on all images
Files: TokenCard.tsx, NftCard.tsx, create/page.tsx, launch-nft/page.tsx, launch/[address]/page.tsx
Every `<img>` / `<Image>` tag must have a non-empty `alt` derived from the token/collection name.
Image upload previews: `alt="Preview"` is acceptable.

### 9.5 Mobile audit and fixes at 375px
Manually inspect (or describe fixes for) each page at 375px width. Known issues to fix:
- **Header**: right-side `hidden md:flex` controls correct ✓, but check logo doesn't overflow
- **Home page**: stats bar → ensure 2×2 grid on mobile (`grid-cols-2` already set ✓), hero text size OK
- **Browse page**: tabs row → add `overflow-x-auto` if tabs overflow on narrow screens
- **Detail page**: two-column grid → `lg:grid-cols-3` collapses to single column ✓, but verify buy panel order (should be FIRST on mobile — reorder in DOM or use `order-` utility)
- **Create page**: step wizard → verify inputs don't overflow, slider thumb is touchable (min 44px target)
- **Portfolio page**: table → add `overflow-x-auto` wrapper around the wide table

### 9.6 Design audit: hover states and spacing
Files: All pages
Verify:
- All `<a>` tags (Link) have visible hover states (underline or color change)
- All card clickable areas have `cursor-pointer`
- Spacing between sections is consistent (use `mb-16` / `mb-20` pattern established in home page)
- In light mode: all text has sufficient contrast (text-primary on bg-base, etc.)

### 9.7 Update README.md
File: `/Users/macbook/midllaunch/README.md` (create if missing, update if exists)
Content:
- Project overview and tech stack
- Prerequisites (Node 18+, npm)
- Installation: `npm install` in frontend + backend
- Run dev: `cd backend && npm run dev` | `cd frontend && npm run dev`
- Contracts: `cd contracts && npx hardhat compile`
- Environment variables: copy `.env.local.example` and `.env.example`, fill in values
- Xverse config fix: explain the indexerUrl fix that was applied
- Known limitations: NFT_FACTORY_ADDRESS not yet deployed on staging
- Explorer links: mempool.staging.midl.xyz, blockscout.staging.midl.xyz

---

## Phases Checklist

- [ ] Phase 1 — Backend gaps (1.1 trending endpoint, 1.2 price-history, 1.3 nft_minted WS, 1.4 Zod validation)
- [ ] Phase 2 — Toast notifications (react-hot-toast wired to wallet, buy, create, copy)
- [ ] Phase 3 — Landing page recent activity list
- [ ] Phase 4 — Browse page NFT tab
- [ ] Phase 5 — Token detail: price chart wire-up, BuyPanel swap, social links, MC stats, AddressChip, TX table, skeletons, confetti
- [ ] Phase 6 — Portfolio: P&L columns, My Activity tab
- [ ] Phase 7 — Global search: collapsible header bar, results dropdown, ⌘K shortcut, page-level shortcuts
- [ ] Phase 8 — next/image migration (6 files) + next.config.ts domains
- [ ] Phase 9 — Polish: page transitions, focus-visible, aria-labels, alt text, mobile fixes, README

## Build Checkpoints (run after each phase)
- After Phase 1: `cd backend && npx tsc --noEmit`
- After Phase 2, 4, 5: `cd frontend && npm run build`
- After Phase 8: `cd frontend && npm run build` (must be zero `<img>` warnings)
- After Phase 9: final `npm run build` — zero errors, zero warnings

## Status
**PLANNING COMPLETE** — Ready to implement phase by phase.
Tasks created in todo system. Awaiting execution order from user.
