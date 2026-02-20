# IMPLEMENT_NOW — No More Auditing. Build Everything.

## HARD RULES — Violating any of these ends the task immediately

1. **NO TODO COMMENTS** — If you write `// TODO`, `// FIXME`, `// coming soon`, `// placeholder`, you have failed. Write the actual implementation instead.
2. **NO HARDCODED STUBS** — No `return []`, no `alert('not implemented')`, no fake data that isn't wired to real state
3. **NO AUDIT LOOPS** — Do not re-read files you've already read to find more bugs. The audit is DONE. Build.
4. **NO "CONTINUE" TRAPS** — Do not stop and ask what to do next. Execute the full list below in order.
5. **MISSING CONTRACTS = CREATE THEM** — If a Solidity contract is required and doesn't exist, write it. Don't skip the feature.
6. **BUILD MUST PASS** — After every 5 implementation tasks, run `npm run build` in frontend. Fix errors immediately. Never leave a broken build.

---

## CONTEXT — What you built vs what was asked

The AGENT_PROMPT.md defines MidlLaunch as a **full launchpad platform** — not a token launcher. It includes token launches, NFT launches, a discovery marketplace, trading terminal UI, and a landing page. The audit confirmed ~40% is built. The remaining 60% needs to be implemented NOW.

You have spent multiple sessions in an audit loop. That loop is closed. Every known bug is fixed. Start building.

---

## IMPLEMENTATION QUEUE — Execute in this exact order

### BATCH A — Backend gaps (do all before touching frontend)

**A1. Add missing Prisma schema columns to Launch model:**
Open `backend/prisma/schema.prisma`. Add these fields to the `Launch` model if missing:
- `description    String?`
- `imageUrl       String?`  
- `metadataCID    String?`
- `twitterUrl     String?`
- `telegramUrl    String?`
- `websiteUrl     String?`
- `launchType     String   @default("TOKEN")`

Then run: `cd backend && npx prisma migrate dev --name "add-metadata-fields"`

**A2. Add NftLaunch and NftMint models to schema:**
```prisma
model NftLaunch {
  id              String    @id @default(cuid())
  contractAddress String    @unique
  name            String
  symbol          String
  totalSupply     Int
  mintPrice       BigInt
  maxPerWallet    Int
  metadataCID     String?
  imageUrl        String?
  description     String?
  twitterUrl      String?
  telegramUrl     String?
  websiteUrl      String?
  totalMinted     Int       @default(0)
  isFinalized     Boolean   @default(false)
  creatorAddress  String
  createdAt       DateTime  @default(now())
  mints           NftMint[]
}

model NftMint {
  id            String    @id @default(cuid())
  launchId      String
  launch        NftLaunch @relation(fields: [launchId], references: [id])
  tokenId       Int
  buyerAddress  String
  pricePaidSats BigInt
  txHash        String
  btcTxHash     String?
  createdAt     DateTime  @default(now())
}
```
Run migration after adding.

**A3. Add PATCH /api/launches/:tokenAddress/metadata endpoint:**
In `backend/src/api/index.ts`, add:
```typescript
app.patch('/api/launches/:tokenAddress/metadata', async (req, res) => {
  const { tokenAddress } = req.params;
  const { metadataCID, imageUrl, description, twitterUrl, telegramUrl, websiteUrl } = req.body;
  if (!tokenAddress) return res.status(400).json({ error: 'tokenAddress required' });
  try {
    const launch = await prisma.launch.update({
      where: { tokenAddress },
      data: {
        ...(metadataCID && { metadataCID }),
        ...(imageUrl && { imageUrl }),
        ...(description && { description }),
        ...(twitterUrl && { twitterUrl }),
        ...(telegramUrl && { telegramUrl }),
        ...(websiteUrl && { websiteUrl }),
      },
    });
    res.json({ launch });
  } catch {
    res.status(404).json({ error: 'Launch not found' });
  }
});
```

**A4. Add GET /api/activity endpoint:**
Global activity feed — last 50 purchases across all launches, sorted newest first.
Return shape: `{ events: [{ type, launchAddress, tokenName, tokenSymbol, buyerAddress, amountSats, tokensReceived, txHash, createdAt }] }`

**A5. Add GET /api/launches/search endpoint:**
```typescript
app.get('/api/launches/search', async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') return res.json({ launches: [] });
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
});
```

**A6. Add GET /api/launches/graduating endpoint:**
Launches where `totalSupplySold / supplyCap >= 0.7`. Compute in JS after fetching since SQLite doesn't support column division in where clauses easily.

**A7. Install express-rate-limit and add rate limiting:**
```bash
cd backend && npm install express-rate-limit
```
Add before routes:
```typescript
import rateLimit from 'express-rate-limit';
const readLimiter = rateLimit({ windowMs: 60_000, max: 100 });
const writeLimiter = rateLimit({ windowMs: 60_000, max: 10 });
app.use('/api', readLimiter);
app.use('/api/launches', writeLimiter);  // POST only via method check
```

**A8. Add NFT API routes:**
Add these endpoints (all wired to NftLaunch/NftMint Prisma models):
- `GET /api/nft-launches` — list with pagination, sortBy (newest, market_cap)
- `GET /api/nft-launches/:address` — single NFT launch detail
- `GET /api/nft-launches/:address/mints` — mint history
- `PATCH /api/nft-launches/:address/metadata` — update metadata fields

**A9. Enhance /api/stats to include:**
`totalNFTLaunches`, `uniqueCreators` (distinct creatorAddress), `uniqueBuyers` (distinct buyerAddress from purchases)

**A10. Enhance /api/user/:address/holdings with P&L:**
Add `avgBuyPriceSats`, `currentPriceSats`, `unrealizedPnlSats`, `unrealizedPnlPct` to each holding.
Current price = `launch.basePrice + (launch.totalSupplySold × launch.priceIncrement)` — compute this from the launch data you already have.

**After A10: Run `npx tsc --noEmit` in backend. Fix all errors. Then continue.**

---

### BATCH B — NFT Smart Contract (create if missing)

Check if `contracts/NftFactory.sol` and `contracts/MidlNFT.sol` exist. If not, create them:

**B1. Create `contracts/MidlNFT.sol`:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MidlNFT is ERC721URIStorage, Ownable {
    uint256 public totalSupply;
    uint256 public maxSupply;
    uint256 public mintPrice; // in wei (mapped from sats via Midl)
    uint256 public maxPerWallet;
    address public creator;
    string public collectionMetadataCID;
    mapping(address => uint256) public mintedPerWallet;
    uint256 private _nextTokenId;

    event NFTMinted(bytes32 indexed intentId, address indexed buyer, uint256 tokenId, uint256 pricePaid);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        uint256 mintPrice_,
        uint256 maxPerWallet_,
        string memory metadataCID_,
        address creator_
    ) ERC721(name_, symbol_) Ownable(creator_) {
        maxSupply = maxSupply_;
        mintPrice = mintPrice_;
        maxPerWallet = maxPerWallet_;
        collectionMetadataCID = metadataCID_;
        creator = creator_;
    }

    function mint(bytes32 intentId, uint256 quantity) external payable {
        require(totalSupply + quantity <= maxSupply, "Exceeds max supply");
        require(mintedPerWallet[msg.sender] + quantity <= maxPerWallet, "Exceeds max per wallet");
        require(msg.value >= mintPrice * quantity, "Insufficient payment");

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(msg.sender, tokenId);
            _setTokenURI(tokenId, string(abi.encodePacked("ipfs://", collectionMetadataCID, "/", _toString(tokenId), ".json")));
            emit NFTMinted(intentId, msg.sender, tokenId, mintPrice);
        }

        totalSupply += quantity;
        mintedPerWallet[msg.sender] += quantity;

        // Send payment to creator
        uint256 creatorShare = msg.value;
        payable(creator).transfer(creatorShare);
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { digits--; buffer[digits] = bytes1(uint8(48 + value % 10)); value /= 10; }
        return string(buffer);
    }
}
```

**B2. Create `contracts/NftFactory.sol`:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MidlNFT.sol";

contract NftFactory {
    address[] public allCollections;
    mapping(address => bool) public isCollection;
    address public admin;

    event CollectionCreated(
        bytes32 indexed intentId,
        address indexed creator,
        address indexed collection,
        string name,
        string symbol,
        uint256 maxSupply,
        uint256 mintPrice
    );

    constructor() {
        admin = msg.sender;
    }

    function createCollection(
        bytes32 intentId,
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        uint256 mintPrice,
        uint256 maxPerWallet,
        string memory metadataCID
    ) external returns (address) {
        require(maxSupply >= 1 && maxSupply <= 10000, "Supply: 1-10000");
        require(maxPerWallet >= 1 && maxPerWallet <= 100, "MaxPerWallet: 1-100");

        MidlNFT collection = new MidlNFT(
            name, symbol, maxSupply, mintPrice, maxPerWallet, metadataCID, msg.sender
        );

        allCollections.push(address(collection));
        isCollection[address(collection)] = true;

        emit CollectionCreated(intentId, msg.sender, address(collection), name, symbol, maxSupply, mintPrice);
        return address(collection);
    }

    function getAllCollections() external view returns (address[] memory) {
        return allCollections;
    }
}
```

**B3. Extract NftFactory ABI:**
Run `npx hardhat compile` then copy the ABI from `artifacts/contracts/NftFactory.sol/NftFactory.json` into `frontend/src/lib/contracts/NftFactory.abi.json`.
Add to `frontend/src/lib/contracts/config.ts`:
```typescript
import NftFactoryABI from './NftFactory.abi.json';
export const NFT_FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_NFT_FACTORY_ADDRESS || '') as `0x${string}`;
export const NFT_FACTORY_ABI = NftFactoryABI;
```

---

### BATCH C — UI Component Library (all 9 missing components)

Create every file below. No placeholders. Working code.

**C1. `frontend/src/components/ui/GlassCard.tsx`:**
```tsx
import { ReactNode } from 'react';
export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass p-6 ${className}`}>{children}</div>;
}
```

**C2. `frontend/src/components/ui/StatPill.tsx`:**
```tsx
export function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-sm px-4 py-3 flex flex-col gap-0.5">
      <span className="font-mono text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
      <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
    </div>
  );
}
```

**C3. `frontend/src/components/ui/PriceDisplay.tsx`:**
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
export function PriceDisplay({ value, suffix = '' }: { value: number; suffix?: string }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (value > prev.current) setFlash('up');
    else if (value < prev.current) setFlash('down');
    prev.current = value;
    const t = setTimeout(() => setFlash(null), 1000);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span className={`font-mono font-medium transition-colors ${flash === 'up' ? 'price-up' : flash === 'down' ? 'price-down' : ''}`}>
      {value.toLocaleString()}{suffix}
    </span>
  );
}
```

**C4. `frontend/src/components/ui/AddressChip.tsx`:**
```tsx
'use client';
import { useState } from 'react';
export function AddressChip({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const short = address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="font-mono text-xs px-2 py-1 rounded-md transition-all hover:opacity-80"
      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--bg-border)' }}
      title={address}>
      {copied ? '✓ Copied' : short}
    </button>
  );
}
```

**C5. `frontend/src/components/ui/ProgressBar.tsx`:**
```tsx
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const level = pct < 40 ? 'low' : pct < 75 ? 'mid' : 'high';
  const colors = { low: 'var(--orange-500)', mid: 'var(--gold)', high: 'var(--green-500)' };
  return (
    <div className="progress-bar-container">
      <div className="progress-bar-fill" style={{ width: `${pct}%`, background: colors[level] }} data-level={level} />
    </div>
  );
}
```

**C6. `frontend/src/components/ui/Badge.tsx`:**
```tsx
export function Badge({ type, children }: { type: 'live' | 'orange' | 'green' | 'red'; children: React.ReactNode }) {
  const cls = { live: 'badge-live', orange: 'badge-orange', green: 'badge-green', red: 'badge-red' };
  return <span className={cls[type]}>{children}</span>;
}
```

**C7. `frontend/src/components/ui/Spinner.tsx`:**
```tsx
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="var(--bg-border)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--orange-500)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
```

**C8. `frontend/src/components/ui/EmptyState.tsx`:**
```tsx
export function EmptyState({ title, description, action }: {
  title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="text-5xl mb-2">₿</div>
      <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {description && <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>{description}</p>}
      {action}
    </div>
  );
}
```

**C9. `frontend/src/components/ui/ErrorState.tsx`:**
```tsx
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="glass p-8 flex flex-col items-center gap-4 text-center">
      <div className="text-3xl">⚠</div>
      <p style={{ color: 'var(--text-secondary)' }}>{message || 'Something went wrong'}</p>
      {onRetry && <button onClick={onRetry} className="btn-ghost text-sm">Try again</button>}
    </div>
  );
}
```

**After C9: Run `npm run build` in frontend. Fix errors. Continue.**

---

### BATCH D — Missing page components (extract from inline code)

**D1. Create `frontend/src/components/charts/PriceChart.tsx`:**
Extract the inline Recharts AreaChart from the token detail page into a standalone component. It must accept `data: Array<{timestamp: number, price: number}>` and `timeframe: '1h' | '6h' | '24h' | '7d'` as props. Style with CSS variables. Add timeframe tab buttons inside the component.

**D2. Create `frontend/src/components/charts/BondingCurveViz.tsx`:**
Extract the BondingCurveChart inline function into a standalone component. Props: `basePrice: number`, `priceIncrement: number`, `supplyCap: number`, `currentSupply: number`. Draw the linear curve with Recharts. Mark the "YOU ARE HERE" position with a vertical line. Shade sold area orange, unsold area dark.

**D3. Create `frontend/src/components/trading/BuyPanel.tsx`:**
Extract the buy form from the token detail page into a standalone component.
Props: `launch: Launch`, `onSuccess?: (txHash: string) => void`.
Must include:
- BTC amount input with BTC icon
- Quick amount buttons: 0.001, 0.005, 0.01, MAX
- Real-time token estimate (calculate from curve math: `basePrice + currentSupply * priceIncrement`)
- Slippage selector: 0.5%, 1%, 2%, custom
- Full SDK transaction flow: `addTxIntentionAsync → finalizeBTCTransactionAsync → signIntentionAsync → sendBTCTransactionsAsync`
- Lifecycle status below button (Signed → BTC Mempool → Midl Executed → Finalized)
- On success: link to blockscout + mempool

**D4. Create `frontend/src/components/tokens/NftCard.tsx`:**
Similar to TokenCard but shows collection image, name, totalMinted/totalSupply progress, mint price in sats, "MINT" CTA.

---

### BATCH E — Missing page sections

**E1. Add "How It Works" section to home page:**
Three glass cards in a row (stack on mobile):
- Step 1: Connect Wallet — "Xverse wallet. No sign-up required."
- Step 2: Launch or Buy — "Fill the form. Sign with BTC. Go live in seconds."
- Step 3: Watch It Moon — "Bonding curve drives price up with every purchase."
Icons: wallet, rocket, chart. Place below the stats bar, above trending tokens.

**E2. Add Feature Strip to home page:**
Four feature pills in a horizontal scroll row:
🟠 Token Launches | 🖼 NFT Launches | 📈 Bonding Curves | ⚡ Real BTC Settlement
Each with a one-line description. Place below "How It Works".

**E3. Add NFT Teaser section to home page:**
Heading: "NFT Launches — Coming Soon"
Three NftCard components in skeleton/placeholder state with "SOON" overlay.
CTA button: "Notify Me" (non-functional but styled).

**E4. Add Holders tab to token detail page:**
Query `/api/launches/:address/purchases` and aggregate by buyer address in the frontend to show top holders. Columns: Rank, Address, Tokens, % of Supply. Use AddressChip for addresses.

**E5. Add share button to token detail page buy panel:**
Below the transaction lifecycle section, add:
```
Share & earn referral →
[midllaunch/launch/0x...?ref=bc1q...]  [Copy 📋]
[Share on X 𝕏]
```
Copy button copies URL to clipboard. X link opens `https://twitter.com/intent/tweet?text=Check out [name] on MidlLaunch&url=[url]`.

---

### BATCH F — NFT Launch Page

**F1. Create `frontend/src/app/launch-nft/page.tsx`:**
Three-step wizard matching the token create wizard style.

Step 1 — Collection Identity:
- Collection Name (text input)
- Symbol (auto-uppercase, max 10)
- Description (textarea)
- Image upload (same IPFS flow as token create — reuse `uploadImageToIPFS`)
- Twitter, Telegram, Website URL fields

Step 2 — Mint Parameters:
- Total Supply: slider 100–10,000
- Mint Price: number input in sats (min 1000)
- Max Per Wallet: slider 1–10
- Show live preview: "At [mintPrice] sats × [totalSupply] supply = max raise of ₿[X]"

Step 3 — Review & Deploy:
- If `NFT_FACTORY_ADDRESS` is set in env: wire the full SDK flow using `NftFactory.abi.json` and `createCollection()` function, same `addTxIntentionAsync → finalizeBTCTransactionAsync → signIntentionAsync → sendBTCTransactionsAsync` pattern as token create
- If `NFT_FACTORY_ADDRESS` is not set: show "NFT Factory not yet deployed to staging — deploying token launches only for this demo" message, still let user fill the form, show the lifecycle UI but with a "Deploy Contract First" notice at the final step
- After transaction: POST metadata to `/api/nft-launches/:address/metadata`

Add "Launch NFT" to the navigation header.

---

### BATCH G — Mobile header hamburger menu

**G1. Create `frontend/src/components/layout/MobileMenu.tsx`:**
```tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  return (
    <>
      <button onClick={() => setOpen(true)} className="md:hidden p-2" aria-label="Open menu">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 glass flex flex-col p-6 gap-6"
            style={{ borderRadius: '0', borderLeft: 'var(--glass-border)' }}>
            <div className="flex justify-between items-center">
              <span className="font-display font-bold text-lg" style={{ color: 'var(--orange-500)' }}>₿ MidlLaunch</span>
              <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:opacity-70">✕</button>
            </div>
            <nav className="flex flex-col gap-1">
              {[['Browse', '/launches'], ['Launch Token', '/create'], ['Launch NFT', '/launch-nft'],
                ['Portfolio', '/portfolio'], ['Transactions', '/transactions']].map(([label, href]) => (
                <Link key={href} href={href} onClick={() => setOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium transition-colors hover:bg-orange-500/10"
                  style={{ color: 'var(--text-secondary)' }}>{label}</Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
```
Import and use `MobileMenu` in the Header, replacing any existing mobile menu code.

---

### BATCH H — Error boundaries and loading skeletons

**H1. Create `frontend/src/components/ui/ErrorBoundary.tsx`:**
```tsx
'use client';
import { Component, ReactNode } from 'react';
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return this.props.fallback ?? (
      <div className="glass p-8 text-center">
        <p style={{ color: 'var(--text-secondary)' }}>Something went wrong.</p>
        <button onClick={() => this.setState({ hasError: false })} className="btn-ghost mt-4 text-sm">Retry</button>
      </div>
    );
    return this.props.children;
  }
}
```
Wrap the chart component and the WebSocket provider in ErrorBoundary in the detail page.

**H2. Create loading skeleton for TokenCard:**
```tsx
export function TokenCardSkeleton() {
  return (
    <div className="token-card overflow-hidden" style={{ minHeight: 280 }}>
      <div className="skeleton" style={{ height: 160, width: '100%' }} />
      <div className="p-4 space-y-3">
        <div className="skeleton rounded" style={{ height: 16, width: '60%' }} />
        <div className="skeleton rounded" style={{ height: 14, width: '80%' }} />
        <div className="skeleton rounded" style={{ height: 4, width: '100%', borderRadius: 100 }} />
        <div className="skeleton rounded" style={{ height: 12, width: '50%' }} />
      </div>
    </div>
  );
}
```
Use TokenCardSkeleton in the browse page and home page while data loads.

---

### FINAL STEPS — Run after all batches complete

1. `cd frontend && npm run build` — must pass with zero errors
2. Fix every TypeScript error found
3. `cd backend && npx tsc --noEmit` — must pass
4. Verify at 375px viewport (iPhone SE): home, browse, detail, create, portfolio pages all render without horizontal scroll or broken layouts
5. Verify dark mode and light mode both work (toggle ThemeToggle)
6. Update `frontend/.env.local.example` and `backend/.env.example` with all new variables: `NEXT_PUBLIC_NFT_FACTORY_ADDRESS`, `NEXT_PUBLIC_PINATA_API_KEY`, `NEXT_PUBLIC_PINATA_SECRET`

**You are done when:** `npm run build` passes, all pages render on mobile, both theme modes work, and none of the implemented features have TODO comments or stub returns.
