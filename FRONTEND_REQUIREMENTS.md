# MidlLaunch Frontend - Complete Requirements Extraction

**Status:** Production-Grade Requirements Analysis
**Last Updated:** February 12, 2026
**Sources:** PRD v1.1, v1.2, v1.3, Improvements Summary, Regression Test Report

---

## Executive Summary

This document extracts EVERY frontend requirement from all 5 PRD files to build a production-grade, pump.fun-quality UI that fully implements the MidlLaunch protocol.

**Critical Success Factors:**
- Orange theme (Bitcoin-native identity) ✅
- Dark + Light mode support ✅
- Professional UI matching pump.fun standards ✅
- Complete transaction lifecycle display (Section 9.9) ✅
- Trust-minimized disclaimers (NOT trustless) ✅
- Real-time state updates ✅
- Explorer link integration ✅

---

## 1. Core Pages & User Flows

### 1.1 Home Page / Landing (PRD Section 10, v1.2 Section 18)

**Required Components:**
1. **Hero Section**
   - Value proposition: "Bitcoin-Native Token Issuance"
   - Tagline: Bonding curve mechanism, deterministic pricing
   - CTA buttons: "Create Launch" + "Browse Launches"

2. **Trust Disclaimer Banner** (MANDATORY - Section 5)
   - Prominent display: "BTC custody is trust-minimized via Midl validators, not self-custodial"
   - Link to validator documentation
   - Warning: "Settlement depends on validator honesty and Bitcoin block confirmation"
   - Must be visible above-the-fold

3. **Featured Launches Section**
   - Grid/list of launches
   - Curated subset (optional curation layer per Section 5)
   - "Featured" badge is centralized trust (explicitly disclosed)

4. **Trending Launches Section**
   - Recent buy activity
   - Volume ranking
   - Progress indicators

5. **Recent Launches Section**
   - Chronological list
   - All launches visible (permissionless)

6. **Statistics Dashboard**
   - Total launches created
   - Total BTC deposited (from indexed events)
   - Total tokens issued
   - 24h volume (if available)

7. **"How It Works" Section**
   - 3-step flow: Create → Buy → Hold/Trade
   - Bonding curve explanation
   - Link to detailed docs

8. **Footer**
   - Links: Docs, Security, Disclaimer, Explorers
   - Trust disclosures repeated
   - Social links (if applicable)

9. **Mobile Responsive**
   - All sections adapt to mobile
   - Touch-optimized interactions

### 1.2 Launch List / Browse Page (PRD Section 10, Section 13)

**Required Features:**

1. **Search Functionality**
   - Search by token name
   - Search by token symbol
   - Real-time filtering

2. **Filter Options**
   - Status: Active / Sold Out / Upcoming
   - Execution mode: Manual / AI-Assisted / Agent-Driven (v1.2)
   - Price range
   - Supply range
   - Creation date

3. **Sort Options**
   - Newest first (default)
   - Price: Low to High / High to Low
   - Volume: Highest first
   - Progress: Most sold / Least sold

4. **Launch Cards** (per launch in grid/list)
   - Token name + symbol
   - Creator address (truncated with copy)
   - Current price (sats per whole token)
   - Supply progress: "X% sold" (derived: totalSupply / supplyCap * 100)
   - Progress bar (visual)
   - Base price + price increment display
   - Execution mode badge (v1.2 Section 19):
     - "✨ AI-Assisted" for AI mode
     - "🤖 Agent-Driven" for agent mode
     - No badge for manual (default)
   - Launch timestamp
   - Click to detail page

5. **View Toggle**
   - Grid view (cards)
   - List view (table rows)

6. **Pagination**
   - Page size: 20 launches per page
   - Infinite scroll (optional)

7. **Empty States**
   - "No launches found" with CTA to create

8. **Loading States**
   - Skeleton loaders while fetching
   - "Loading..." indicators

9. **Real-Time Updates** (Section 13, WebSocket)
   - New launches appear at top
   - Progress bars update on purchases
   - Price updates propagate

10. **Last Updated Indicator** (Section 13)
    - Display "last indexed block" timestamp
    - Visual indicator if data is stale (> 5 minutes)
    - "Refresh from chain" button

### 1.3 Launch Detail Page (PRD Section 10 Flow 2, Section 9.9)

**Required Sections:**

1. **Header**
   - Token name (large, prominent)
   - Token symbol (ticker)
   - Creator address (full, copyable)
   - Link to creator profile (if exists)
   - Execution mode badge (v1.2)
   - Share button (copy link, social share)

2. **Price Chart** (TradingView style or Recharts)
   - X-axis: Time or supply
   - Y-axis: Price in sats
   - Bonding curve visualization
   - Historical purchase points
   - Tooltips on hover

3. **Supply Progress**
   - Large progress bar
   - "X / Y tokens sold" (in whole tokens)
   - Percentage display
   - Color coding: Green (active), Gray (sold out)

4. **Current Price Display**
   - Large number: "1,234,567 sats per token"
   - Next price (after 1 token buy): "1,234,668 sats"
   - Price increment: "+101 sats per token"

5. **Launch Parameters** (Card/Table)
   - Base Price: 1,000,000 sats (Section 7B.3)
   - Price Increment: 100 sats (Section 7B.3)
   - Supply Cap: 10,000,000 tokens (Section 7B.2)
   - Creator Fee Rate: 1.0% (if set)
   - Total BTC Deposited: 12.34567890 BTC (Section 7B.5 - NOT a reserve proof)

6. **Buy Widget** (CRITICAL - Section 10 Flow 2)
   - **Input: BTC Amount**
     - Satoshi input (uint256)
     - Conversion helpers: "= 0.001 BTC"
     - Min/Max validation

   - **Quote Calculation** (Section 8, Appendix A)
     - Call `curve.calculatePurchaseReturn(btcInSats, currentSupply)`
     - Display expected tokens: "You will receive: ~1,234 tokens"
     - Display new price after buy: "New price: 1,235,000 sats"

   - **Slippage Settings** (Section 7B.6)
     - Slippage tolerance: Default 1%, adjustable (0.5%, 1%, 2%, 5%, custom)
     - Calculate `minTokensOut = expectedTokens * (1 - slippage)`
     - Display: "Minimum tokens: 1,222 (with 1% slippage)"

   - **Buy Button**
     - Disabled states: Wallet not connected, supply cap reached, invalid input
     - Enabled state: "Buy Tokens"
     - Click → Wallet sign flow

   - **Transaction Signing Flow** (Section 9.2, 9.3)
     - Construct Bitcoin transaction via midl-js SDK
     - Send BTC to BondingCurvePrimaryMarket address
     - Attach Midl intent: `buy(minTokensOut)`
     - User signs via wallet (Xverse/Unisat)
     - Show confirmation modal

7. **Transaction History Table**
   - Columns: Time, Buyer, BTC Spent, Tokens Received, Price, Tx Link
   - Most recent first
   - Pagination (20 per page)
   - Real-time updates (WebSocket)
   - Click row → transaction detail modal

8. **Holder Distribution** (Optional)
   - Pie chart or table
   - Top 10 holders
   - "Circulating supply" vs "held by creator"

9. **Launch Description/Metadata** (Section 5 - Explicitly Trusted)
   - Display with disclaimer: "Metadata is user/AI/agent-provided and unverified"
   - Sanitize HTML/links (prevent XSS)
   - If AI-assisted: "✨ AI-Assisted Launch — User-Confirmed Parameters"
   - If agent-driven: "🤖 Agent-Launched by [agentId]" + "⚠️ Autonomous Launch — Verify Claims Independently"

10. **Social Links** (If provided in metadata)
    - Website, Twitter, Discord, Telegram
    - Display as unverified: "⚠️ Links are unverified"

11. **Explorer Links** (MANDATORY - Section 9.8)
    - **Bitcoin Explorer**: Link to FBT txid on `mempool.staging.midl.xyz` (staging) or `mempool.space` (mainnet)
    - **Midl Explorer**: Link to Midl execution tx on `blockscout.staging.midl.xyz`
    - Prominent placement: "Verify on Bitcoin Explorer" + "Verify on Midl Explorer"

12. **Warning Modals** (Risk Disclosures)
    - Before first buy: Show disclaimer modal
      - "Tokens are NOT guaranteed to have value"
      - "Creator may sell immediately (no vesting)"
      - "Validator custody is trust-minimized, not trustless"
      - "You are responsible for verifying parameters"
      - Checkbox: "I understand and accept the risks"

13. **Trust Disclaimers** (Section 5, repeated)
    - Footer or sidebar: "This protocol uses trust-minimized validator custody. See docs for details."

14. **Mobile Optimized**
    - Responsive layout
    - Touch-friendly buy widget
    - Scrollable history table

15. **Real-Time Updates** (Section 13)
    - Price updates on new buys
    - Supply progress updates
    - Transaction history appends new rows
    - Chart updates with new data points

### 1.4 Create Launch Page (PRD Section 10 Flow 1, v1.2 Section 18)

**Execution Mode Selection** (v1.2 - OPTIONAL for v1, Manual REQUIRED):

1. **Mode Selector** (If implementing modes)
   - Radio buttons: Manual / AI-Assisted / Agent-Driven
   - Default: Manual
   - Description of each mode

**Manual Launch Form** (REQUIRED):

1. **Token Information**
   - **Token Name**
     - Input: Text, required
     - Validation: 1-50 characters, no profanity filter (permissionless)
     - Example placeholder: "My Bitcoin Token"

   - **Token Symbol**
     - Input: Text, required
     - Validation: 1-10 characters, uppercase recommended
     - Example placeholder: "MBT"

2. **Supply Parameters** (Section 8 - Parameter Bounds)
   - **Supply Cap**
     - Input: Number (whole tokens)
     - Bounds: [1,000,000, 21,000,000] (Section 8)
     - Display current value + bounds
     - Helper text: "Total tokens that can ever be minted"

3. **Curve Parameters** (Section 8 - NORMATIVE)
   - **Base Price** (sats per whole token)
     - Input: Number (satoshis)
     - Bounds: [1,000, 1,000,000] sats (Section 8)
     - Display: "1,000 - 1,000,000 sats"
     - Helper text: "Price of the first token"

   - **Price Increment** (sats per token per token)
     - Input: Number (satoshis)
     - Bounds: [1, 10,000] sats (Section 8)
     - Helper text: "Price increases by this amount for each token sold"

4. **Creator Fee** (Optional, Section 7)
   - Input: Percentage (basis points)
   - Bounds: [0, 1000] (0% - 10%)
   - Default: 100 (1%)
   - Helper text: "Fee you receive on each purchase"

5. **Metadata** (Optional, Section 5 - Explicitly Trusted)
   - **Description**
     - Textarea, optional
     - Max 1000 characters
     - Markdown support (sanitized)

   - **Token Image**
     - File upload, optional
     - Max 2MB, PNG/JPG
     - Square aspect ratio recommended

   - **Social Links**
     - Website URL (optional)
     - Twitter handle (optional)
     - Discord invite (optional)
     - Telegram group (optional)

6. **Parameter Preview** (Live Calculation)
   - **Cost Calculation**
     - "Total BTC required to create launch: 0.00010000 BTC"
     - Based on LaunchFactory deployment cost

   - **Bonding Curve Visualization**
     - Chart showing price vs supply
     - X-axis: Supply (0 to cap)
     - Y-axis: Price (basePrice to maxPrice)
     - Interactive: hover to see price at any supply level

   - **Example Scenarios**
     - "If someone buys 1,000 tokens, they will pay: X BTC"
     - "If all tokens are sold, total BTC raised: Y BTC"

7. **Form Validation** (Real-Time + Submit)
   - All bounds checked against Section 8
   - Required fields validated
   - Display errors inline (red text below inputs)
   - Disable submit button if invalid

8. **Warning Modals** (Parameter Implications)
   - If basePrice near minimum: "Low base price may enable cheap acquisition"
   - If priceIncrement near minimum: "Low increment may result in low final price"
   - Require confirmation: "I understand the implications"

9. **Confirm Creation Modal**
   - Summary of all parameters
   - Estimated BTC cost
   - Warnings repeated
   - "Create Launch" button

10. **Transaction Signing Flow** (Section 9.2)
    - User signs Bitcoin transaction
    - Send BTC to LaunchFactory address
    - Attach Midl intent: `createLaunch(name, symbol, supplyCap, basePrice, priceIncrement, creatorFeeRate)`
    - Show signing modal from wallet
    - Transaction broadcast confirmation

11. **Success State**
    - Display: "Launch Created Successfully!"
    - Show token address, curve address
    - Links to launch detail page
    - Links to explorers (Bitcoin + Midl)

12. **Error Handling**
    - If transaction reverts: Display revert reason
    - If wallet rejects: "Transaction cancelled by user"
    - Retry button

13. **Draft Save/Restore** (localStorage)
    - Auto-save form inputs every 30 seconds
    - Restore on page reload
    - "Clear draft" button

**AI-Assisted Launch** (v1.2 Section 18.3 - OPTIONAL):

1. **AI Interface** (If implementing)
   - Chat interface or wizard
   - User describes intent: "Create a meme token for my cat"
   - AI suggests: name, symbol, supply, curve params, description
   - Display all suggestions with "AI-Suggested (Not Audited)" label

2. **Review & Approve Screen**
   - All AI suggestions editable
   - Prominent: "Review AI Output" warning
   - User MUST explicitly confirm: "I have reviewed AI suggestions and accept responsibility"

3. **Same validation as Manual**
   - All Section 8 bounds enforced
   - No bypass for AI mode

**Agent-Driven Launch** (v1.2 Section 18.4 - OPTIONAL, NOT for qualifier):
- API endpoint, not UI flow
- Out of scope for initial frontend

### 1.5 User Profile / Portfolio Page (PRD Section 10, Section 13)

**Required Sections:**

1. **User Address Display**
   - Full Bitcoin address
   - Copy button
   - QR code (optional)

2. **Token Holdings**
   - Table: Token Name, Symbol, Balance, Value (if calculable), Actions
   - Filter by: All / Active / Sold Out
   - Sort by: Value, Balance, Name

3. **Holdings Value Calculation** (Derived)
   - For each token: balance * currentPrice
   - Total portfolio value in BTC
   - Disclaimer: "Value based on current bonding curve price, not market price"

4. **Created Launches**
   - List of launches user created
   - Status: Active / Sold Out
   - Total BTC raised
   - Creator fees earned

5. **Purchase History**
   - Chronological list
   - Columns: Time, Launch, BTC Spent, Tokens Received, Status
   - Click → transaction detail

6. **Activity Timeline**
   - Combined view of creates + buys
   - Most recent first

7. **Portfolio Chart** (Optional)
   - Historical value over time
   - Per-token breakdown

8. **Export Activity** (CSV)
   - Download button
   - All transactions in CSV format

9. **Wallet Connection Status**
   - Display connected wallet
   - Network display: Midl Staging / Mainnet
   - "Disconnect" button

### 1.6 Transaction Center / History (PRD Section 9.9 - CRITICAL)

**Transaction Lifecycle States** (NORMATIVE - Section 9.9):

The UI MUST expose these states for EVERY transaction:

1. **Signed / Broadcast**
   - FBT created and broadcast
   - Display: "Transaction broadcast to Bitcoin network"
   - Show FBT txid
   - Link to mempool: `https://mempool.staging.midl.xyz/tx/[txid]`
   - Icon: ⏳ Pending
   - Color: Yellow/Orange

2. **BTC Included**
   - FBT confirmed in Bitcoin block (≥ 1 conf)
   - Display: "Bitcoin transaction confirmed (1 confirmation)"
   - Icon: ✅ Confirmed
   - Color: Blue

3. **Midl Executed**
   - Midl execution transaction visible on Blockscout
   - MidlLaunch events present (LaunchCreated or TokensPurchased)
   - Display: "Midl execution complete"
   - Link to Blockscout: `https://blockscout.staging.midl.xyz/tx/[txid]`
   - Show event data
   - Icon: ⚡ Executed
   - Color: Purple

4. **Finalized**
   - Economic finality reached (≥ N confirmations)
   - N = 1 for staging, 3-6 for mainnet (Section 4)
   - Display: "Transaction finalized (N confirmations)"
   - Icon: ✅ Finalized
   - Color: Green

5. **Failed (Reverted)**
   - Midl execution reverted
   - Display revert reason: "Slippage exceeded", "Supply cap reached", etc.
   - Display: "Transaction failed: [reason]"
   - Note: "Refund pending via RBT"
   - Icon: ❌ Failed
   - Color: Red

6. **Refunded**
   - RBT (Return BTC Transaction) visible on Bitcoin
   - Display: "Refund received"
   - Link to RBT txid on mempool
   - Show refund amount (BTC sent - network fees)
   - Icon: ↩️ Refunded
   - Color: Gray

**Transaction Detail Modal:**
- Full timeline with timestamps
- FBT txid + link
- Midl tx hash + link
- RBT txid + link (if applicable)
- Event data (intentId, amounts, etc.)
- Status badges
- Retry button (if applicable)

**Transaction List View:**
- Table: Time, Type (Create/Buy), Status, BTC Amount, Tokens, Links
- Filter by: All / Pending / Confirmed / Failed
- Search by txid or intentId
- Real-time status updates (WebSocket or polling)

**Notifications:**
- Toast on status change: "Transaction confirmed"
- Browser notification (if permitted)

---

## 2. Wallet Integration (PRD Section 10, v1.2)

**Required Wallet Support:**

### 2.1 Xverse Wallet (MINIMUM REQUIRED)

1. **Detection**
   - Check for `window.XverseProvider` or equivalent
   - Show "Install Xverse" if not detected

2. **Connection Flow**
   - "Connect Wallet" button
   - Trigger Xverse connection popup
   - Request Bitcoin address + permissions
   - Store connection state

3. **Message Signing** (BIP322)
   - Sign arbitrary messages for authentication
   - Required for Intent binding (Section 9.2)

4. **Transaction Signing** (FBT)
   - Construct Bitcoin transaction via midl-js SDK
   - Send to Xverse for user signature
   - Broadcast signed tx

5. **Disconnection**
   - Clear connection state
   - "Disconnect Wallet" button

### 2.2 Unisat Wallet (SECONDARY)

- Same flow as Xverse
- Different provider object: `window.unisat`

### 2.3 Wallet Provider Abstraction

**Interface:**
```typescript
interface WalletProvider {
  connect(): Promise<string>; // Returns Bitcoin address
  disconnect(): void;
  signMessage(message: string): Promise<string>;
  signTransaction(tx: BitcoinTx): Promise<string>;
  getAddress(): string | null;
  isConnected(): boolean;
}
```

**Implementations:**
- `XverseWalletProvider`
- `UnisatWalletProvider`

**State Management:**
- Zustand store or React Context
- Persist connection: localStorage
- Handle account/network changes

### 2.4 Network Handling

**Network Detection:**
- Detect if wallet is on correct network (Midl Staging / Mainnet)
- If wrong network: Show warning modal "Please switch to Midl Staging"
- Disable transactions until correct network

**Network Switching:**
- Attempt auto-switch (if wallet supports)
- Fallback: Show manual instructions

### 2.5 Error Handling

**Common Errors:**
- Wallet not installed → Show install prompt
- User rejected connection → "Connection cancelled"
- User rejected transaction → "Transaction cancelled"
- Insufficient balance → "Insufficient BTC balance"
- Wrong network → "Please switch to [network]"
- Transaction timeout → "Transaction timed out, please retry"

---

## 3. Contract Integration (midl-js SDK)

### 3.1 SDK Setup (PRD Section 10, Section 9)

**Installation:**
```bash
npm install midl-js ethers@6
```

**Configuration:**
```typescript
import { MidlProvider } from 'midl-js';

const provider = new MidlProvider('https://rpc.staging.midl.xyz');
const factoryAddress = '0x...'; // Deployed LaunchFactory
```

### 3.2 BTC Transaction Construction

**Create Launch Transaction:**
```typescript
// Construct Intent
const intent = {
  target: factoryAddress,
  calldata: encodeFunctionData({
    abi: LaunchFactoryABI,
    functionName: 'createLaunch',
    args: [name, symbol, supplyCap, basePrice, priceIncrement, creatorFeeRate]
  }),
  value: btcCostInSats, // From quote
};

// Construct FBT (Funding BTC Transaction)
const fbt = await constructBitcoinTx({
  to: factoryAddress,
  value: btcCostInSats,
  intent: intent,
});

// Sign via wallet
const signedTx = await wallet.signTransaction(fbt);

// Broadcast
const txid = await provider.broadcastTransaction(signedTx);
```

**Buy Transaction:**
```typescript
const intent = {
  target: curveAddress,
  calldata: encodeFunctionData({
    abi: BondingCurveABI,
    functionName: 'buy',
    args: [minTokensOut] // Section 7B.6
  }),
  value: btcInSats,
};

// Same FBT construction + signing + broadcast flow
```

### 3.3 Contract Read Operations

**Get Launch Data:**
```typescript
// Current supply
const supply = await tokenContract.totalSupply();

// Current price
const price = await curveContract.getCurrentPrice();

// Calculate purchase return
const tokensOut = await curveContract.calculatePurchaseReturn(btcInSats, supply);

// Total BTC deposited
const totalBTC = await curveContract.totalBTCDepositedSats();

// Supply cap
const cap = await tokenContract.supplyCap();
```

**Get User Balances:**
```typescript
const balance = await tokenContract.balanceOf(userAddress);
```

### 3.4 Event Listening

**LaunchCreated Event:**
```typescript
factoryContract.on('LaunchCreated', (tokenAddress, curveAddress, creator, intentId, supplyCap, curveParams) => {
  // Update UI
  // Add new launch to list
  // Show notification
});
```

**TokensPurchased Event:**
```typescript
curveContract.on('TokensPurchased', (buyer, intentId, btcAmount, tokenAmount, newSupply, newPrice) => {
  // Update supply display
  // Update price display
  // Add to transaction history
  // Update chart
});
```

**LaunchFinalized Event:**
```typescript
curveContract.on('LaunchFinalized', (tokenAddress, finalSupply, totalBTCDeposited) => {
  // Mark launch as sold out
  // Disable buy button
  // Show "Sold Out" badge
});
```

### 3.5 Error Parsing

**Revert Reasons:**
```typescript
try {
  await curveContract.buy(minTokensOut, { value: btcInSats });
} catch (error) {
  if (error.reason === 'Slippage exceeded') {
    // Show: "Price moved too much. Try increasing slippage tolerance."
  } else if (error.reason === 'Supply cap reached') {
    // Show: "This launch is sold out."
  } else {
    // Show: "Transaction failed: [reason]"
  }
}
```

---

## 4. Real-Time Data & WebSocket (PRD Section 13)

### 4.1 WebSocket Connection

**Setup:**
```typescript
const ws = new WebSocket('wss://api.midllaunch.xyz/ws');

ws.on('open', () => {
  // Subscribe to channels
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'launches' }));
  ws.send(JSON.stringify({ type: 'subscribe', channel: `launch:${launchId}` }));
});
```

**Reconnection Logic:**
- Auto-reconnect on disconnect
- Exponential backoff: 1s, 2s, 4s, 8s, max 30s
- Resubscribe to channels on reconnect

**Heartbeat/Ping-Pong:**
- Send ping every 30 seconds
- Expect pong response
- Disconnect if no pong after 60s

### 4.2 Event Types

**New Launch:**
```typescript
{
  type: 'launch_created',
  data: {
    tokenAddress: '0x...',
    curveAddress: '0x...',
    creator: '0x...',
    name: 'Token Name',
    symbol: 'TKN',
    supplyCap: '1000000',
    basePrice: '50000',
    priceIncrement: '100',
    timestamp: 1234567890
  }
}
```

**Token Purchase:**
```typescript
{
  type: 'tokens_purchased',
  launchId: 'launch-xyz',
  data: {
    buyer: '0x...',
    btcAmount: '100000',
    tokenAmount: '1234000000000000000000', // base units
    newSupply: '5678000000000000000000',
    newPrice: '51234',
    timestamp: 1234567890
  }
}
```

**Price Update:**
```typescript
{
  type: 'price_update',
  launchId: 'launch-xyz',
  data: {
    newPrice: '51234',
    newSupply: '5678000000000000000000'
  }
}
```

### 4.3 Optimistic Updates

**Buy Transaction:**
1. User submits buy → Show pending state immediately
2. Update local supply/price optimistically
3. If WebSocket confirms → Remove pending state
4. If transaction fails → Revert optimistic update + show error

**Rollback Logic:**
```typescript
const optimisticUpdate = (buyAmount) => {
  // Calculate expected tokens
  const expectedTokens = calculatePurchaseReturn(buyAmount, currentSupply);

  // Update UI optimistically
  setSupply(currentSupply + expectedTokens);
  setPrice(getCurrentPrice(currentSupply + expectedTokens));

  // Mark as pending
  setPendingTx(txid);

  // Wait for confirmation
  await waitForConfirmation(txid);

  // If failed, rollback
  if (failed) {
    setSupply(currentSupply);
    setPrice(getCurrentPrice(currentSupply));
    showError('Transaction failed');
  }
};
```

### 4.4 Cache Invalidation

**When to invalidate:**
- New launch created → Invalidate launches list cache
- Purchase confirmed → Invalidate launch detail cache
- Price changed → Invalidate price cache

**Strategy:**
- Short TTL: 10 seconds for frequently changing data (price, supply)
- Long TTL: 5 minutes for static data (launch parameters)
- Invalidate on WebSocket event

---

## 5. UI Components & Design System

### 5.1 Color Palette (Bitcoin Orange Theme)

**Primary Colors:**
```css
--primary-500: #f97316; /* Bitcoin Orange */
--primary-600: #ea580c; /* Darker Orange */
--primary-700: #c2410c; /* Deep Orange */
--primary-400: #fb923c; /* Light Orange */
--primary-300: #fdba74; /* Very Light Orange */
```

**Neutral Colors:**
```css
/* Dark Mode */
--background-dark: #0a0a0a;
--surface-dark: #1a1a1a;
--surface-dark-2: #2a2a2a;
--text-dark: #ffffff;
--text-dark-secondary: #a3a3a3;

/* Light Mode */
--background-light: #ffffff;
--surface-light: #f5f5f5;
--surface-light-2: #e5e5e5;
--text-light: #0a0a0a;
--text-light-secondary: #525252;
```

**Semantic Colors:**
```css
--success: #22c55e;
--warning: #f59e0b;
--error: #ef4444;
--info: #3b82f6;
```

### 5.2 Typography

**Font Family:**
- Primary: Inter, system-ui, sans-serif
- Monospace: 'Roboto Mono', monospace (for addresses, numbers)

**Type Scale:**
```css
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
--text-5xl: 3rem;      /* 48px */
```

**Font Weights:**
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700

### 5.3 Spacing System

**Based on 4px grid:**
```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
```

### 5.4 Breakpoints

```css
--breakpoint-sm: 640px;   /* Mobile */
--breakpoint-md: 768px;   /* Tablet */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Large Desktop */
```

### 5.5 Dark Mode Implementation

**Strategy:**
- Use CSS custom properties for colors
- Toggle via `.dark` class on `<html>` element
- Persist preference in localStorage
- Default to system preference: `prefers-color-scheme`

**Toggle Component:**
- Sun/Moon icon
- Smooth transition between modes
- Keyboard accessible

### 5.6 Core Components

**Button:**
- Variants: Primary, Secondary, Outline, Ghost, Danger
- Sizes: sm, md, lg
- States: Default, Hover, Active, Disabled, Loading
- Icon support: Left, Right, Icon-only

**Input:**
- Types: Text, Number, Email, etc.
- Variants: Default, Error, Disabled
- Helper text below input
- Error message in red

**Card:**
- Background: Surface color
- Border: 1px solid border color
- Border radius: 8px
- Padding: var(--space-6)
- Shadow: Subtle on hover

**Modal/Dialog:**
- Backdrop: rgba(0, 0, 0, 0.5)
- Content: Surface color, centered
- Close button: Top right
- Keyboard: ESC to close
- Accessibility: Focus trap, ARIA labels

**Dropdown Menu:**
- Trigger button
- Popover content
- Max height with scroll
- Keyboard navigation

**Tabs:**
- Underline style
- Active state: Primary color
- Keyboard navigation

**Toast/Notification:**
- Position: Top right
- Auto-dismiss: 5 seconds (configurable)
- Variants: Success, Error, Warning, Info
- Close button

**Progress Bar:**
- Filled portion: Primary color
- Background: Gray
- Percentage text (optional)
- Animated on update

**Skeleton Loader:**
- Shimmer effect
- Matches content shape
- Gray background

**Badge:**
- Small pill shape
- Variants: Primary, Secondary, Success, Warning, Error
- Text size: xs

**Tooltip:**
- Appears on hover
- Delay: 500ms
- Arrow pointing to target
- Dark background, white text
- Max width: 200px

---

## 6. Accessibility (WCAG 2.1 AA)

**Required Features:**

1. **Keyboard Navigation**
   - All interactive elements focusable
   - Tab order logical
   - Focus indicators visible (2px outline)
   - Skip to content link

2. **Screen Reader Support**
   - Semantic HTML (header, nav, main, footer)
   - ARIA labels on all interactive elements
   - ARIA live regions for dynamic content
   - Alt text on all images
   - Form labels properly associated

3. **Color Contrast**
   - All text meets 4.5:1 ratio (WCAG AA)
   - Large text (18px+) meets 3:1
   - Check in both light and dark modes

4. **Focus Management**
   - Modal opened → Focus first element
   - Modal closed → Return focus to trigger
   - Dropdown opened → Focus first item
   - Toast dismissed → No focus trap

5. **Responsive Text**
   - Supports up to 200% zoom
   - No horizontal scroll at 320px width
   - Line height: 1.5
   - Paragraph spacing: 1.5x line height

6. **Form Validation**
   - Error messages announced to screen readers
   - Error summary at top of form
   - Required fields marked with asterisk + "required" in label

---

## 7. Performance Optimization

**Required Optimizations:**

1. **Bundle Size**
   - Initial bundle < 500kb (gzipped)
   - Code splitting by route
   - Lazy load components not needed for initial render
   - Tree-shaking enabled

2. **Asset Optimization**
   - Images: WebP format, responsive sizes
   - Fonts: Subset, preload
   - SVG: Optimize with SVGO
   - Icons: Sprite sheet or icon font

3. **Caching**
   - Static assets: Cache-Control: max-age=31536000 (1 year)
   - API responses: Short TTL (10s - 5min)
   - Service worker for offline support (optional)

4. **Core Web Vitals**
   - LCP (Largest Contentful Paint) < 2.5s
   - FID (First Input Delay) < 100ms
   - CLS (Cumulative Layout Shift) < 0.1

5. **React Optimization**
   - React.memo for expensive components
   - useMemo for expensive calculations
   - useCallback for event handlers passed to children
   - Virtual scrolling for long lists (react-window)
   - Debounce search inputs (300ms)

6. **Data Fetching**
   - Request deduplication
   - Parallel queries where possible
   - Stale-while-revalidate pattern
   - Pagination for large datasets

---

## 8. SEO Configuration

**Required Meta Tags:**

```html
<!-- Title -->
<title>MidlLaunch - Bitcoin-Native Token Issuance</title>

<!-- Description -->
<meta name="description" content="Launch and trade tokens on Bitcoin via deterministic bonding curves. Trust-minimized settlement on Midl.">

<!-- Open Graph -->
<meta property="og:title" content="MidlLaunch">
<meta property="og:description" content="Bitcoin-Native Token Issuance">
<meta property="og:image" content="/og-image.png">
<meta property="og:url" content="https://midllaunch.xyz">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="MidlLaunch">
<meta name="twitter:description" content="Bitcoin-Native Token Issuance">
<meta name="twitter:image" content="/twitter-image.png">

<!-- Favicon -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
```

**robots.txt:**
```
User-agent: *
Allow: /

Sitemap: https://midllaunch.xyz/sitemap.xml
```

**sitemap.xml:**
- Home page
- Browse launches
- Individual launch pages (dynamic)

---

## 9. Error Handling & Edge Cases

**Global Error Boundary:**
- Catch React errors
- Display friendly error message
- Log to error tracking service (Sentry)
- "Reload page" button

**Network Errors:**
- API down → Show "Service temporarily unavailable"
- Slow request → Show loading state, timeout after 30s
- Failed request → Retry with exponential backoff (max 3 retries)

**Wallet Errors:**
- Not installed → Install prompt
- Wrong network → Network switch prompt
- Rejected transaction → "Transaction cancelled"
- Insufficient balance → "Insufficient funds"

**Contract Errors:**
- Revert → Display reason (slippage, cap reached, etc.)
- Out of gas → "Transaction failed: Insufficient gas"
- Invalid parameters → "Invalid input: [field]"

**Edge Cases:**
- Launch sold out mid-transaction → Show "Sold out" error
- Price moved significantly → Slippage protection triggered
- Concurrent buys → Order determined by validator sequencing
- User disconnects wallet mid-flow → Clear state, redirect to home
- WebSocket disconnect → Fallback to polling
- Stale data → Show "Data may be outdated" warning

---

## 10. Testing Requirements

**Unit Tests:**
- All components: Render without crashing
- All hooks: Return correct values
- All utilities: Correct calculations
- Coverage: 80%+

**Integration Tests:**
- Wallet connection flow
- Create launch flow
- Buy flow
- Transaction lifecycle display

**E2E Tests (Playwright/Cypress):**
- User can connect wallet
- User can create launch
- User can buy tokens
- Transaction states update correctly
- Explorer links work

**Visual Regression Tests:**
- Storybook with Chromatic
- All components in all states
- Dark + Light modes
- All breakpoints

**Accessibility Tests:**
- axe-core in unit tests
- Manual screen reader testing (NVDA, JAWS)
- Keyboard navigation testing

---

## 11. Documentation Requirements

**User Guides:**
- Getting started (connect wallet)
- How to create a launch
- How to buy tokens
- Understanding transaction states
- Risk disclaimers

**Developer Docs:**
- Component API docs (Storybook)
- Hooks documentation
- State management guide
- Contract integration guide

**API Documentation:**
- REST API endpoints (if applicable)
- WebSocket events
- Error codes

---

## 12. Deployment Requirements

**Environment Variables:**
```bash
# Network
VITE_NETWORK=staging # or mainnet
VITE_RPC_URL=https://rpc.staging.midl.xyz
VITE_FACTORY_ADDRESS=0x...
VITE_BLOCKSCOUT_URL=https://blockscout.staging.midl.xyz
VITE_MEMPOOL_URL=https://mempool.staging.midl.xyz

# WebSocket
VITE_WS_URL=wss://api.midllaunch.xyz/ws

# Analytics (optional)
VITE_ANALYTICS_ID=...
```

**Build Process:**
```bash
npm run build
# Output: dist/
```

**Vercel Deployment:**
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables configured in Vercel dashboard

**Staging vs Production:**
- Staging: Midl staging network, N=1 confirmations
- Production: Midl mainnet, N=3-6 confirmations
- Separate environment variable files

---

## 13. Monitoring & Analytics

**Error Tracking:**
- Sentry integration
- Log all errors with context
- User ID (wallet address)
- Transaction ID if applicable

**Analytics:**
- Page views
- User actions: Connect wallet, Create launch, Buy tokens
- Conversion funnel: Visit → Connect → Create/Buy
- Transaction success/failure rates

**Performance Monitoring:**
- Core Web Vitals tracking
- API response times
- WebSocket connection health
- Time to interactive

---

## 14. Compliance & Legal

**Required Disclaimers:**

1. **Trust Model** (Section 5)
   - "BTC custody is trust-minimized via Midl validators, not self-custodial"
   - "Settlement depends on validator honesty"

2. **Token Risk**
   - "Tokens are NOT guaranteed to have value"
   - "No fairness guarantees or anti-bot mechanisms"
   - "Creator may sell immediately (no vesting)"

3. **Metadata**
   - "Metadata is user/AI/agent-provided and unverified"

4. **AI-Assisted** (if implemented)
   - "AI-Suggested (Not Audited)"
   - "User is responsible for verifying parameters"

5. **Agent-Driven** (if implemented)
   - "Agent-Launched — Verify Claims Independently"
   - "Agents are explicitly untrusted actors"

**Terms of Service Link:**
- Footer link to terms
- User must acknowledge before first transaction (optional)

**Privacy Policy Link:**
- Footer link to privacy policy
- GDPR compliance if applicable

---

## Summary Checklist

### Must-Have for Production:

- [ ] Orange theme + Dark/Light mode ✅
- [ ] All 6 transaction states displayed (Section 9.9) ✅
- [ ] Trust disclaimers prominent ✅
- [ ] Explorer links (Bitcoin + Midl) ✅
- [ ] Real-time updates (WebSocket) ✅
- [ ] Wallet integration (Xverse minimum) ✅
- [ ] Create launch flow with validation ✅
- [ ] Buy flow with slippage protection ✅
- [ ] Transaction history with status ✅
- [ ] Mobile responsive ✅
- [ ] Accessibility (WCAG 2.1 AA) ✅
- [ ] Error handling comprehensive ✅
- [ ] Performance optimized (Core Web Vitals) ✅
- [ ] SEO configured ✅
- [ ] Testing: Unit + Integration + E2E ✅

### Optional (Can defer):

- [ ] AI-Assisted mode (v1.2)
- [ ] Agent-Driven mode (v1.2)
- [ ] Portfolio value charts
- [ ] Activity export (CSV)
- [ ] Service worker / offline support
- [ ] Advanced analytics

---

**This document now contains EVERY frontend requirement from all 5 PRD files. Ready for systematic implementation.**
