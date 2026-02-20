# MidlLaunch: Product Requirements Document

**Version:** 1.1  
**Date:** February 8, 2026  
**Status:** Production Specification (Mainnet-Credible)  
**Deployment Environments:** Staging (Qualifier) / Mainnet (Production)

---

## 1. Executive Summary

MidlLaunch is a Bitcoin-native bonding curve issuance protocol that enables deterministic, on-chain creation and distribution of fungible tokens via a primary-market bonding curve.

**What MidlLaunch is:**
- A token factory and issuance protocol implemented in Solidity on Midl's EVM execution layer
- A buy-side bonding curve mechanism where token price increases deterministically with supply
- A system where users sign Bitcoin transactions with Bitcoin wallets and Midl validators execute EVM logic
- A verifiable protocol with settlement observable on Bitcoin explorers and Midl block explorers

**What MidlLaunch is NOT:**
- A secondary market or automated market maker (AMM)
- A trustless custody solution (custody is trust-minimized via Midl validators and TSS vaults)
- A fairness guarantee mechanism (no anti-bot or anti-snipe claims)
- A liquidity migration system (no automated AMM graduation in v1)

**Core problem solved:**
Bitcoin script constraints prevent enforceable, stateful issuance logic. Projects requiring deterministic pricing curves, supply caps, or composable post-issuance hooks cannot implement these guarantees using Bitcoin script alone. Midl's EVM execution layer enables Solidity-enforced invariants while maintaining Bitcoin-native settlement and wallet UX.

**Why Midl is required:**
Midl provides EVM execution with Bitcoin finality. Users sign standard Bitcoin transactions, Midl validators execute Solidity contracts via TSS-controlled vaults, and outcomes settle on Bitcoin. This removes the need for bridges, wrapped assets, or non-Bitcoin wallets while enabling complex, auditable issuance logic that Bitcoin script cannot express.

---

## 2. Problem Definition & Motivation

### Current Bitcoin token issuance constraints

Bitcoin-native token systems (Runes, BRC-20) rely on inscription or protocol-specific script patterns. These approaches externalize critical logic to indexers and off-chain interpreters, creating several failure modes:

1. **No enforceable issuance invariants**: Supply caps, vesting schedules, and pricing curves are convention-based, not consensus-enforced.
2. **Limited composability**: Post-issuance actions (governance, staking, collateralization) require new protocol layers or centralized services.
3. **Indexer trust**: Canonical state depends on off-chain indexing correctness and availability.
4. **No deterministic pricing**: Bonding curves or fair launch mechanisms cannot be enforced on-chain.

Existing Bitcoin launchpad attempts (e.g., Odin.fun for Runes) implement bonding curves but rely on off-chain logic or script-only constraints. These systems have demonstrated exploit classes related to AMM pricing assumptions and reserve accounting mismatches.

### Why script-only approaches fail

Bitcoin script is non-Turing-complete by design. It cannot maintain mutable state, perform complex arithmetic safely across transactions, or enforce stateful access control. For issuance protocols, this means:

- Price curves must be computed off-chain and trusted
- Supply tracking is indexer-dependent
- Multi-step flows (create, configure, issue, lock) cannot be atomically enforced
- Reserve accounting (BTC held vs tokens issued) has no on-chain verification

### Why Midl changes feasibility

Midl is an EVM-compatible execution layer built on Bitcoin. Users interact with Bitcoin wallets (Xverse, Unisat) and sign standard Bitcoin transactions. Midl validators execute Solidity contracts and return Bitcoin transactions to users.

Key properties:
- **Stateful execution**: Solidity contracts can maintain supply counters, price curves, and access control
- **Deterministic computation**: Bonding curve math executes in EVM with verifiable correctness
- **Event emission**: Indexers can rely on canonical contract events rather than external protocol interpretation
- **Bitcoin finality**: Settlement occurs on Bitcoin L1 (via Midl validator commitments)

**Critical constraint**: Midl custody model relies on validator-controlled TSS vaults. This is trust-minimized (threshold security), not trustless. Users send BTC to validator vaults, intents are executed, and BTC transactions are returned.

---

## 3. Goals & Non-Goals

### Goals (v1 scope)

1. **Deterministic issuance**: Token supply and pricing are verifiable on-chain via Solidity invariants.
2. **Bitcoin-native UX**: Users sign Bitcoin transactions with Bitcoin wallets; no bridge or wrapped asset required.
3. **Verifiable settlement**: Every action produces observable proof on Bitcoin mempool and Midl block explorer.
4. **Auditability**: Issuance logic, reserve accounting, and parameter constraints are inspectable in Solidity.
5. **Composability foundation**: Token contracts are ERC20-compatible; other Midl protocols can integrate launched tokens.

### Non-Goals (explicitly rejected)

1. **Secondary market trading**: No AMM, no order book, no liquidity pools. Users acquire tokens via the bonding curve or use external DEXs post-launch.
   - **Reason**: AMM migration introduces valuation exploit classes (documented in Odin.fun incident). Deferring to v2+ after formal invariant specification and audit.

2. **Sell-side curve logic**: No mechanism for users to sell tokens back to the curve for BTC in v1.
   - **Reason**: Sell settlement requires symmetric BTC reserve guarantees. Reserve accounting mismatches between contract state and actual BTC held in TSS vaults create existential risk. Requires deeper settlement model before inclusion.

3. **Anti-bot or fairness guarantees**: No per-address buy caps, no commit-reveal, no time-sliced issuance.
   - **Reason**: Enforcement mechanisms are either sybil-vulnerable (address caps), trust-dependent (allowlists), or add latency/complexity (commit-reveal). Protocol remains permissionless; fairness is emergent, not enforced.

4. **Trustless custody claims**: MidlLaunch does not claim trustless BTC custody.
   - **Reason**: Midl validators control TSS vaults. This is explicit trust-minimization via threshold signatures, not elimination of trust.

5. **Cross-chain or wrapped asset support**: No bridging to/from other chains.
   - **Reason**: Out of scope; adds custody and settlement complexity.

---

## 4. Deployment Environments

MidlLaunch is specified as a **mainnet-credible protocol** that supports deployment in both staging (qualifier) and production (mainnet) environments. This section defines environment-specific parameters.

### 4.1 Staging / Qualifier Environment

**Purpose:** Enable rapid prototyping, qualifier submission, and public demonstration.

**Network parameters:**
- Network: Midl Regtest / Staging
- RPC Endpoint: `https://rpc.staging.midl.xyz` (or regtest equivalent)
- Bitcoin Explorer: `https://mempool.staging.midl.xyz`
- Midl Explorer: `https://blockscout.staging.midl.xyz`
- Faucet: `https://faucet.midl.xyz`

**Settlement parameters:**
- Confirmation threshold (N): **1 block** (rapid demo; acceptable for zero-value testing)
- Fee policy: Simplified (protocol/creator fees may be accounted on-chain but not settled via RBTs; deferred payout)
- Refund guarantees: Best-effort by validators (no SLA)

**Proof requirements:**
- Every launch and purchase must produce verifiable proof on staging explorers
- Links required: FBT txid (mempool.staging) + Midl execution tx (blockscout.staging)

**Acceptable trust assumptions:**
- Staging validators are operated by Midl team (centralized; acceptable for testing)
- No economic security guarantees
- State may be reset between qualifier phases

### 4.2 Mainnet / Production Environment

**Purpose:** Real economic activity with user funds at risk.

**Network parameters:**
- Network: Midl Mainnet
- RPC Endpoint: TBD (must have redundancy and published SLA)
- Bitcoin Explorer: `https://mempool.space` or equivalent with archival guarantees
- Midl Explorer: Production Blockscout instance with uptime SLA
- No faucet (real BTC)

**Settlement parameters:**
- Confirmation threshold (N): **3-6 blocks** (must be justified and documented; recommend 3 for UX, 6 for high-value launches)
- Fee policy: Full settlement (protocol/creator fees must be paid via RBTs within defined settlement window or via periodic sweeps with documented frequency)
- Refund guarantees: Enforced by Midl validator slashing conditions (must be published)

**Proof requirements:**
- Same as staging but on mainnet explorers
- Archival requirement: explorers must retain data indefinitely

**Required trust disclosures:**
- Mainnet UI must display validator set composition and TSS threshold
- Clear warning: "BTC custody is trust-minimized via validators, not self-custodial"
- Link to Midl validator slashing/security documentation

**Operational SLAs (must be defined before mainnet):**
- RPC availability: 99.9% uptime target
- Blockscout availability: 99.5% uptime target
- Maximum execution latency: TBD (must measure on staging)
- Maximum refund settlement time: TBD (must be contractually committed by validator set)

### 4.3 Environment Transition Requirements

To promote from staging to mainnet, the following must be completed:

1. **Smart contract audit** by reputable external firm
2. **Settlement model validation** with Midl team (confirm refund semantics, fee handling, finality)
3. **Legal review** (regulatory classification of launched tokens)
4. **Stress testing** on staging (minimum 100 launches, 1000 purchases, simulated failure modes)
5. **Wallet compatibility testing** (Xverse, Unisat at minimum)
6. **Operational runbooks** (incident response, fee sweeping, admin key management)
7. **Public security disclosure** (trust boundaries, validator assumptions, known limitations)

---

## 5. System Actors & Trust Boundaries

### Actors

1. **Token Creators**
   - Deploy new token contracts via LaunchFactory
   - Configure bonding curve parameters (within protocol bounds)
   - Receive creator fees (if configured)

2. **Token Buyers**
   - Sign Bitcoin transactions to purchase tokens on the bonding curve
   - Receive minted tokens to their Midl-compatible address
   - Observe settlement via Bitcoin and Midl explorers

3. **Midl Validators**
   - Execute EVM transactions from user-signed Bitcoin transactions
   - Control TSS vaults where user BTC is held during execution
   - Return Bitcoin transactions to users post-execution
   - Commit Midl state to Bitcoin

4. **Indexers**
   - Read contract events from Midl RPC/Blockscout
   - Compute derived state (current price, total sold, launch status)
   - Serve data to frontends

5. **Frontends**
   - Display launch information, pricing, supply
   - Construct Bitcoin transactions via Midl SDK
   - Show explorer links for verification

### Trust Boundaries (explicit)

**Trustless (consensus-enforced):**
- Solidity invariants inside Midl EVM execution environment (curve math, supply accounting, minting rules, event emission)
- Assumption: Midl EVM execution is correct

**Trust-minimized (threshold security):**
- Midl validator set: Users sign Bitcoin transactions, validators execute EVM logic and control TSS vaults
- BTC custody: Funds move through validator-controlled TSS vaults during execution (not self-custodial)
- Settlement ordering: Validators sequence transactions; ordering attacks are possible within validator honesty assumptions

**Explicitly trusted (operational):**
- Frontend correctness: UI displays price, supply, expected outputs (users must verify via explorers)
- Indexer availability: Derived data (e.g., "launch progress") depends on indexer uptime and correctness
- Metadata accuracy: Token names, descriptions, images are not consensus-validated

**Governance/Curation:**
- If "featured launches" or "verified creators" are added, these are trust-dependent labels

### Critical assumption statement

Users must understand:
- Midl validators execute logic and control BTC during execution
- Settlement finality depends on Midl validator honesty and Bitcoin block confirmation
- The protocol enforces issuance rules in Solidity but does not guarantee BTC custody is trustless

---

## 6. Protocol Overview

### High-level lifecycle

**Launch creation:**
1. Creator signs Bitcoin transaction to deploy token via LaunchFactory
2. Factory deploys LaunchToken (ERC20) + BondingCurvePrimaryMarket contract
3. Contract parameters are immutable (curve type, supply cap, creator address)
4. Launch is registered in factory's canonical registry
5. Event emitted: `LaunchCreated(tokenAddress, curveAddress, creator, params)`

**Issuance (buy flow):**
1. User signs Bitcoin transaction sending BTC to curve contract
2. Validators execute: curve calculates tokens to mint based on current supply and BTC received
3. Tokens minted to user's address
4. Supply counter incremented
5. Event emitted: `TokensPurchased(buyer, btcAmount, tokenAmount, newSupply, newPrice)`

**Curve progression:**
- Price = f(totalSupply) (monotonically increasing)
- Each purchase increases supply and raises price for next buyer
- No sell mechanism; users hold or trade on external markets

**Finalization state:**
- When supply reaches configured cap (or other finalization condition), curve stops minting
- Event emitted: `LaunchFinalized(tokenAddress, finalSupply, totalBTCRaised)`
- No further issuance; token becomes fixed-supply ERC20

### State machine (textual)

**Launch states:**
1. **UNINITIALIZED**: Before factory deployment
2. **ACTIVE**: Curve is minting; supply < cap
3. **FINALIZED**: Supply = cap; no further minting

**Transitions:**
- UNINITIALIZED → ACTIVE: LaunchFactory.createLaunch() completes
- ACTIVE → FINALIZED: Buy transaction pushes supply to cap

**Invariants enforced on-chain:**
- Total minted supply ≤ configured supply cap (always)
- Price is monotonically increasing with supply (always)
- Only curve contract can mint tokens (always)
- Supply cap and curve parameters are immutable post-deployment (always)

---

## 7. Smart Contract Architecture

### LaunchFactory

**Responsibility:**
- Deploy token and curve contracts
- Maintain canonical registry of launches
- Enforce protocol-level parameter constraints

**Stored state:**
```solidity
mapping(address => LaunchMetadata) public launches;
address[] public allLaunches;
uint256 public protocolFeeRate; // e.g., 50 = 0.5%
address public feeRecipient;
```

**Invariants:**
- Once deployed, a launch cannot be re-deployed at the same address
- Curve parameters must fall within protocol bounds (e.g., max supply cap = 21M tokens)
- Creator address is immutable

**Failure conditions:**
- Deploy reverts if parameters violate bounds
- No admin can alter deployed launches

### LaunchToken

**Responsibility:**
- ERC20-compliant fungible token
- Restrict minting to authorized curve contract
- Enforce supply cap

**Stored state:**
```solidity
string public name;
string public symbol;
uint8 public decimals; // fixed at 18
uint256 public supplyCap;
address public minter; // bonding curve address (immutable)
```

**Invariants:**
- `totalSupply() <= supplyCap` (always)
- Only `minter` can call `mint()`
- `name`, `symbol`, `supplyCap`, `minter` are immutable

**Failure conditions:**
- `mint()` reverts if caller != minter
- `mint()` reverts if minting would exceed `supplyCap`

### BondingCurvePrimaryMarket

**Responsibility:**
- Implement bonding curve pricing logic
- Mint tokens on BTC receipt
- Emit canonical purchase events
- Enforce slippage protection

**Stored state:**
```solidity
LaunchToken public token;
uint256 public totalBTCDepositedSats;  // Per Section 7B.5
uint256 public curveType; // enum: LINEAR (only in v1)
uint256 public basePrice_sats_per_token;  // Per Section 7B.3
uint256 public priceIncrement_sats_per_token_per_token;  // Per Section 7B.3
uint256 public creatorFeeRate; // e.g., 100 = 1% (basis points)
address public creator;
address public factory;  // For protocol fee rate lookup
```

**Invariants:**
- Price monotonically increases with `token.totalSupply()` (per Section 8)
- `totalBTCDepositedSats` tracks cumulative `msg.value` for successful buys (per Section 7B.5)
- Curve parameters are immutable

**Failure conditions:**
- Buy reverts if calculated tokens < user's specified `minTokensOut` (slippage protection)
- Buy reverts if minting would exceed token supply cap
- Math overflow/underflow reverts

**Key function: `buy(bytes32 intentId, uint256 minTokensOut)`**
```solidity
function buy(bytes32 intentId, uint256 minTokensOut) external payable {
    // msg.value represents vBTC credited per Section 9.3
    // Actual BTC custody is in validator TSS vaults
    uint256 btcAmountSats = msg.value;
    
    // Get current supply in base units
    uint256 currentSupplyBaseUnits = token.totalSupply();
    
    // Calculate tokens to mint (returns base units per Section 7B.6)
    uint256 tokensToMintBaseUnits = calculatePurchaseReturn(btcAmountSats, currentSupplyBaseUnits);
    require(tokensToMintBaseUnits >= minTokensOut, "Slippage exceeded");
    
    // Mint tokens
    token.mint(msg.sender, tokensToMintBaseUnits);
    
    // Update reserve accounting
    totalBTCDepositedSats += btcAmountSats;
    
    // Emit event with intentId correlation (per Section 9.8)
    emit TokensPurchased(
        msg.sender,
        intentId,
        btcAmountSats,
        tokensToMintBaseUnits,
        token.totalSupply(),
        getCurrentPrice()
    );
    
    // Fee handling per Section 9.6:
    // V1 recommended: fees accounted on-chain, settled via periodic RBTs or deferred
    // Implementation depends on environment-specific fee policy
}
```

**Critical note on settlement (per Section 9):**
The contract receives `msg.value` as vBTC credited during Midl execution. Actual BTC custody is in validator TSS vaults. Refunds on revert are handled by validators producing RBTs (per Section 9.5), not by contract logic.

### MetadataRegistry (optional)

**Responsibility:**
- Store immutable creator disclosures (description, socials, risk flags)
- Separate protocol truth from UI curation

**Stored state:**
```solidity
mapping(address => bytes32) public metadataHashes; // IPFS CID or similar
```

**Invariants:**
- Metadata hash is write-once per launch

**Failure conditions:**
- Cannot overwrite existing metadata

---

## 7B. Canonical Unit Conventions (Normative)

> **Purpose:** eliminate ambiguity between "whole tokens", "token base units", satoshis, and the value credited to contracts.

### 7B.1 Bitcoin Amount Units

* All BTC-denominated quantities in contracts are represented in **satoshis** as `uint256 sats`.
* Any amount sourced from `msg.value` is interpreted as **satoshis** under the settlement model (Section 9.3).
* UI MUST display BTC amounts in sats and BTC with consistent formatting.

### 7B.2 Token Amount Units

* `LaunchToken` uses **18 decimals**.
* The canonical token base unit is:

  * `TOKEN_UNIT = 1e18` base units per 1 whole token.

Contracts MUST:

* store balances/supply in base units (standard ERC20).
* convert to "whole token" display only in UI.

### 7B.3 Pricing Unit Choice (Normative Decision)

**Decision:** MidlLaunch v1 defines curve prices in **satoshis per 1 whole token**.

* `basePrice_sats_per_token` is sats required to mint **1.0 token** (i.e., `TOKEN_UNIT` base units) at supply = 0.
* `priceIncrement_sats_per_token_per_token` is sats added to the per-token price for each additional **1.0 token** of supply minted.

This choice matches user mental models and avoids silent 1e18 scaling errors in UX.

### 7B.4 Internal Calculation Convention (Normative)

All curve math MUST operate in integer arithmetic with explicit scaling:

* Supply `S` is in token base units.
* Define `s = S / TOKEN_UNIT` as whole-token supply (integer floor) ONLY if you explicitly accept quantization; otherwise define a fixed-point supply `s_fp = S` and incorporate TOKEN_UNIT in formula.

**Recommended v1 approach (auditable + bounded):**

* Treat supply in **whole tokens** for pricing (s = totalSupply / 1e18), and accept that pricing steps occur per whole token minted.
* Minting output is still in base units.
* This yields predictable behavior and easy auditability.

If you require smooth per-base-unit pricing, you must define a fixed-point formulation explicitly and prove bounded overflow; do not leave this ambiguous.

### 7B.5 `totalBTCRaised` Redefinition (Normative)

The contract state variable previously named `totalBTCRaised` is renamed and redefined:

* `totalBTCDepositedSats` = cumulative **credited** satoshis used for successful buys (sum of `msg.value` for buys that did not revert).
* It MUST be clear whether this is gross or net of system fees (see Section 9.3 / 9.6).

**Non-claim:** `totalBTCDepositedSats` is not a cryptographic proof of reserves in the TSS vault. It is an on-chain accounting figure of credited execution value.

### 7B.6 Conversion for Quoting Tokens Out (Normative)

When quoting expected tokens for a buy:

* Input: `btcInSats` (user-intended sats to deposit)
* Contract computes `tokensOutBaseUnits`
* UI displays `tokensOut = tokensOutBaseUnits / 1e18`

Slippage bounds (`minTokensOut`) MUST be specified in **token base units** to match on-chain minting quantities.

---

## 8. Bonding Curve Design

### Supported curve family

**V1 scope: Linear curve only**

```
Price(supply) = basePrice + (supply * priceIncrement)
```

Where:
- `basePrice`: minimum price (e.g., 1000 sats per token)
- `priceIncrement`: sats per token per token minted (e.g., 10 sats)

**Example:**
- Supply = 0: Price = 1000 sats
- Supply = 100: Price = 1000 + (100 * 10) = 2000 sats

**Why linear:**
- Simplest to audit and reason about
- Monotonic by construction
- No exponential overflow risk
- Deterministic integration (area under curve = total BTC for supply range)

### Parameter constraints

Protocol-enforced bounds:
- `basePrice`: [1000 sats, 1M sats]
- `priceIncrement`: [1 sat, 10k sats]
- `supplyCap`: [1M tokens, 21M tokens] (using 18 decimals)

Rationale:
- Prevents pathological curves (e.g., basePrice = 0, instant exit scam)
- Bounds computational complexity
- Aligns with Bitcoin denomination norms

### Price calculation guarantees

**On-chain guarantees:**
- Price is computed deterministically from `totalSupply` and curve parameters
- Price is monotonically increasing (enforced by linear slope)
- No external dependencies (no oracles, no time-based logic)

**Not guaranteed:**
- Actual BTC received by user on sell (no sell in v1)
- That price is "fair" or "competitive" (market-determined)

### Purchase return calculation

```solidity
function calculatePurchaseReturn(uint256 btcIn, uint256 currentSupply) 
    public view returns (uint256 tokensOut) 
{
    // Solve integral: btcIn = ∫[currentSupply to currentSupply+tokensOut] Price(s) ds
    // For linear: btcIn = basePrice * tokensOut + priceIncrement * (tokensOut^2 / 2 + currentSupply * tokensOut)
    
    // Simplified: iterative approximation or closed-form quadratic solution
    // Implementation uses fixed-point math (18 decimals) and safe arithmetic
    
    // Pseudo-code:
    uint256 a = priceIncrement / 2;
    uint256 b = basePrice + priceIncrement * currentSupply;
    uint256 c = -btcIn;
    tokensOut = quadraticSolution(a, b, c); // Standard quadratic formula with overflow checks
}
```

### Rounding and overflow handling

**Philosophy:**
- All math uses SafeMath or Solidity 0.8+ overflow checks
- Fixed-point arithmetic with 18 decimals (standard ERC20)
- Rounding favors the protocol (user receives floor(tokensOut), not ceil)

**Testing requirements:**
- Property-based tests: for all valid inputs, `price(supply + 1) > price(supply)`
- Boundary tests: max supply, max BTC input, edge parameter values
- Integration tests: cumulative BTC in = area under curve (within rounding tolerance)

### What is enforced vs assumed

**Enforced on-chain:**
- Price monotonicity
- Supply cap
- Token minting authorization
- Event emission

**Assumed (trust-minimized):**
- BTC reserve in TSS vaults matches `totalBTCRaised` (depends on validator honesty)
- Validators execute buy() transactions in user-expected order

**Not enforced:**
- That token has "value" post-issuance
- That creator won't abandon project
- That UI shows accurate pricing (users must verify via contract calls)

---

## 9. Settlement Model (Normative)

> **Purpose:** This section is normative. It defines the authoritative semantics for (a) how a Bitcoin wallet action becomes an EVM execution, (b) how `msg.value` is interpreted, (c) how failures/refunds behave, and (d) what constitutes settlement finality and proof.

### 9.1 Terminology (Normative)

* **Funding BTC Transaction (FBT):** A Bitcoin transaction created and signed by the user's Bitcoin wallet that transfers BTC (and optionally Runes) to a Midl **TSS Vault** output controlled by the active validator group. 
* **Intent:** A "virtual Midl dApp transaction" signed by the user's BTC private key (BIP322 signing requirement), which includes (i) target contract, (ii) calldata, (iii) value, and (iv) an attached reference to an FBT txid. 
* **Execution:** The validators acknowledge the next Bitcoin block containing the FBT, then process the corresponding Midl transactions. 
* **Return BTC Transaction (RBT):** A Bitcoin transaction produced by validators that returns BTC (and/or Runes) to user addresses as the outcome of execution. 
* **Virtual BTC (vBTC):** An internal Midl accounting representation used during EVM execution; validators "virtually mint" corresponding assets to process the dApp transaction and burn them after execution, then settle via RBT. 

### 9.2 Canonical Execution Binding (Normative)

MidlLaunch recognizes a purchase as valid **only** when all of the following hold:

1. **Funding observed:** An FBT exists on Bitcoin transferring BTC to the Midl TSS Vault output(s). 
2. **Intent binding:** The user's signed Intent includes the **FBT txid** and is signed by the same BTC key controlling the purchase source address (wallet signature). 
3. **Validator processing:** Validators acknowledge a Bitcoin block containing the FBT and process the Midl transaction(s) corresponding to the bound Intent(s). 
4. **State commitment:** Validators commit Midl state to Bitcoin via compact proofs / Merkle root commitments between Bitcoin blocks (system-level). 

**Non-goal:** MidlLaunch does not claim trustless binding. The binding is enforced operationally by Midl validators and their consensus/slashing rules, not by Bitcoin script.

### 9.3 `msg.value` Semantics (Normative)

For MidlLaunch contracts:

* `msg.value` in `BondingCurvePrimaryMarket.buy(...)` represents **vBTC credited to the execution** for that Midl transaction.
* The credited vBTC amount MUST be computed as:

> **msg.value (sats) = (FBT_sats_to_vault) − (execution-level deductions, if any)**

Where "execution-level deductions" includes any **explicit protocol-defined fees** that Midl charges *before* crediting the EVM call. If Midl credits the gross amount, deductions = 0.

**Requirement:** The deployment environment MUST define whether `msg.value` is **gross** or **net of system fees**, and the frontend MUST quote based on the same definition. (See 9.6 Fee Accounting.)

### 9.4 Ordering and Batching (Normative)

* Validators sequence Midl transactions. Ordering manipulation is possible within validator assumptions.
* Midl supports sending **up to 10 Midl transactions within a single BTC transaction**. MidlLaunch supports this by treating each Midl tx independently with its own `msg.value` and calldata, but requiring they reference the same FBT txid when batched. 

### 9.5 Failure Semantics and Refunds (Normative)

MidlLaunch distinguishes **EVM execution failure** from **Bitcoin transaction failure**:

* The FBT is a Bitcoin transaction signed by the user. Once broadcast, it may confirm independently of EVM execution success.
* Therefore, MidlLaunch MUST define refund behavior at the settlement layer boundary.

**Normative requirement (protocol-level expectation):**

If the Midl transaction corresponding to an Intent **reverts** (including slippage failure, cap exceeded, or arithmetic failure), then validators MUST produce an RBT that returns the BTC amount attributable to that failed Midl transaction to the user's designated refund address, **minus Bitcoin network fees** required to create the RBT.

* If multiple Midl txs are batched in one FBT, refunds are computed per failed tx based on its allocated vBTC.
* MidlLaunch smart contracts MUST NOT assume refunds are instantaneous; the UI MUST represent refunds as asynchronous settlement events.

**Trust statement:** Refund correctness is **trust-minimized** and depends on validator liveness/honesty and Midl's slashing conditions for refusal/invalid execution. 

### 9.6 Fee Accounting (Normative)

MidlLaunch defines three fee categories:

1. **Bitcoin network fees:** Miner fees for the FBT (paid by user) and RBT (paid from returned funds or validator policy).
2. **Midl system fees (if applicable):** Any fees deducted by Midl *before* EVM crediting. This affects `msg.value`.
3. **MidlLaunch protocol/creator fees:** Fees specified by MidlLaunch and accounted for inside contracts.

**Requirement:** For each environment, MidlLaunch MUST specify:

* Whether protocol/creator fees are **(a) retained as vBTC accounting only** (tracked on-chain, settled later), or **(b) settled via RBTs** to fee recipients in the same settlement window.
* If fee payouts occur via RBT, the PRD MUST specify whether the fee recipients are paid:

  * (i) in the same Bitcoin block window as execution, or
  * (ii) in a later aggregated payout.

**V1 recommended policy (to minimize custody complexity):**

* Protocol/creator fees are accounted for on-chain as **sats-denominated liabilities** and paid out via periodic RBTs executed by a designated fee-sweeper role controlled by governance/admin policy (explicitly trusted operational role), OR deferred entirely in staging.

### 9.7 Finality Definitions (Normative)

MidlLaunch defines finality at three layers:

* **Bitcoin inclusion:** FBT is visible on Bitcoin mempool and later confirmed in a Bitcoin block.
* **Midl execution finality:** The Midl transaction is executed and visible on the Midl explorer (Blockscout instance).
* **Economic finality (MidlLaunch):** A purchase is considered final only when:

  1. Midl execution succeeded (event emitted), AND
  2. the underlying Bitcoin block containing the FBT has at least **N confirmations** (environment parameter).

**Environment parameter:**

* Staging / qualifier: N may be 1 (for rapid demo) consistent with Midl's "one Bitcoin block confirmation" UX target. 
* Mainnet production: N MUST be explicitly selected and justified (e.g., 3 or 6), and reflected in UI state transitions.

### 9.8 Observability and Proof Requirements (Normative)

For each user action (launch creation, purchase):

* The UI MUST present:

  * the **FBT txid** (Bitcoin explorer link), and
  * the **Midl execution tx hash** (Blockscout link), and
  * the emitted MidlLaunch event(s).

**Correlation requirement:**

* Each MidlLaunch event MUST include a deterministic correlation field that allows joining Midl tx ↔ FBT txid (either the FBT txid itself if available in EVM context, or a derived `intentId` supplied via calldata).

If EVM cannot access the FBT txid directly, the PRD MUST require:

* `intentId = keccak256( user_pubkey || fbt_txid || target || calldata || value )`
  and the same `intentId` is included in calldata and emitted in events.

### 9.9 UI Transaction Lifecycle (Normative)

The UI MUST expose these states:

1. **Signed / Broadcast:** FBT created and broadcast; tx visible on mempool explorer.
2. **BTC Included:** FBT confirmed in Bitcoin (≥ 1 conf).
3. **Midl Executed:** Midl execution transaction is visible on Blockscout and MidlLaunch events are present.
4. **Finalized:** Economic finality reached (≥ N conf and execution success).
5. **Failed (Reverted):** Midl execution reverted; refund pending.
6. **Refunded:** RBT visible returning funds; user can verify via Bitcoin explorer.

---

## 10. Transaction Flows (Implementation Guidance)

### Flow 1: Launch Creation

**User action:**
1. User visits frontend, inputs token parameters (name, symbol, supply cap, curve params)
2. Frontend validates parameters against protocol bounds
3. User signs Bitcoin transaction via Xverse/Unisat wallet
   - Bitcoin tx sends small amount (e.g., 10k sats) to LaunchFactory address
   - Midl intent attached: `createLaunch(name, symbol, supplyCap, curveParams)`

**Wallet signing:**
- Standard Bitcoin transaction signature (ECDSA)
- Midl SDK constructs transaction with intent payload

**Midl execution:**
1. Validators receive Bitcoin transaction
2. Extract Midl intent and execute `LaunchFactory.createLaunch()`
3. Factory deploys LaunchToken and BondingCurvePrimaryMarket contracts
4. Registers launch in mapping
5. Emits `LaunchCreated` event

**Bitcoin settlement:**
- Validators commit Midl state change to Bitcoin (via validator mechanism)
- Bitcoin transaction appears in mempool: `https://mempool.staging.midl.xyz/tx/[txid]`

**Explorer-verifiable proof:**
- Bitcoin tx: Shows user signature and BTC movement
- Midl Blockscout: `https://blockscout.staging.midl.xyz/tx/[txid]`
  - Shows LaunchFactory contract interaction
  - Displays `LaunchCreated` event with token and curve addresses

**UI-observable state update:**
1. Frontend queries LaunchFactory for new launch address
2. Displays: token contract address, curve address, parameters, Blockscout link
3. User can verify on Blockscout: contract code, events, initial state

**Finality:**
- After Bitcoin block confirmation (~10 minutes)
- Midl state committed to Bitcoin
- Launch is canonical and immutable

### Flow 2: Token Purchase

**User action:**
1. User navigates to launch page
2. Frontend queries BondingCurvePrimaryMarket:
   - Current supply: `token.totalSupply()`
   - Current price: `curve.getCurrentPrice()`
3. User inputs BTC amount (e.g., 100k sats)
4. Frontend calculates expected tokens: `curve.calculatePurchaseReturn(100000, currentSupply)`
5. User sets slippage tolerance (e.g., 1%)
   - `minTokensOut = expectedTokens * 0.99`
6. User signs Bitcoin transaction:
   - Sends 100k sats to BondingCurvePrimaryMarket address
   - Midl intent: `buy(minTokensOut)`

**Wallet signing:**
- Standard Bitcoin transaction (user's BTC wallet signature)
- Transaction visible in mempool immediately

**Midl execution:**
1. Validators receive Bitcoin transaction
2. Execute `BondingCurvePrimaryMarket.buy(minTokensOut)` with `msg.value = 100000`
3. Contract calculates actual tokens to mint
4. Mints tokens to user's address
5. Updates `totalBTCDepositedSats` and `token.totalSupply()`
6. Emits `TokensPurchased` event

**Bitcoin settlement:**
- User's Bitcoin transaction confirms in next block
- Validators return BTC transaction outcome (if applicable)

**Explorer-verifiable proof:**
- Bitcoin mempool: `https://mempool.staging.midl.xyz/tx/[txid]`
  - Shows user's 100k sats sent to curve contract
- Midl Blockscout: `https://blockscout.staging.midl.xyz/tx/[txid]`
  - Shows `buy()` call
  - Displays `TokensPurchased` event with exact amounts
  - Shows token balance update

**UI-observable state update:**
1. Frontend listens for `TokensPurchased` event
2. Updates user's token balance display
3. Updates global supply and current price
4. Shows transaction links for verification

**Failure modes:**
- If actual tokens < `minTokensOut`: transaction reverts, refund issued per Section 9.5
- If supply cap reached: transaction reverts, refund issued per Section 9.5
- If math overflow: transaction reverts, refund issued per Section 9.5

**Confirmation states:**
Per Section 9.9:
1. **Signed / Broadcast**: FBT visible in mempool
2. **BTC Included**: FBT confirmed in Bitcoin block
3. **Midl Executed**: Midl transaction confirmed, event emitted
4. **Finalized**: Economic finality reached (≥ N confirmations)
5. **Failed (Reverted)**: Refund pending
6. **Refunded**: RBT visible

---

## 11. Failure Modes & Regression Analysis

### Technical Failures

**1. Reserve accounting mismatch**
- **Scenario**: Contract state shows `totalBTCDepositedSats = 10 BTC equivalent`, but actual BTC in TSS vault = 9.8 BTC
- **Severity**: Non-critical for buy-only v1; would be existential if sell were implemented
- **Cause**: Validator execution error, TSS vault bug, or fee calculation mismatch
- **Mitigation**: 
  - V1 has no sell; mismatch doesn't impact token issuance (per Section 7B.5)
  - For future sell logic: require proof-of-reserves mechanism or restrict sell to verifiable BTC redemptions
  - Protocol governance can pause issuance if severe mismatch detected

**2. Curve calculation overflow/rounding error**
- **Scenario**: Large BTC purchase causes arithmetic overflow; or cumulative rounding errors diverge from expected price
- **Severity**: Critical (breaks pricing integrity)
- **Mitigation**:
  - Use Solidity 0.8+ overflow checks
  - Extensive property-based testing: `calculatePurchaseReturn()` for all valid input ranges
  - Fuzz testing for edge cases (max BTC, max supply)
  - Formal verification of curve monotonicity (if resources permit)

**3. Reentrancy on buy()**
- **Scenario**: Malicious token or external call during `buy()` re-enters contract
- **Severity**: Critical (could allow double-minting)
- **Mitigation**:
  - Follow checks-effects-interactions pattern
  - Use ReentrancyGuard (OpenZeppelin)
  - No external calls during state-changing logic

**4. Supply cap bypass**
- **Scenario**: Race condition or logic error allows minting beyond `supplyCap`
- **Severity**: Existential (violates core invariant)
- **Mitigation**:
  - Enforce cap in LaunchToken.mint() (not just curve)
  - Require `totalSupply + amount <= supplyCap` in both contracts
  - Unit test: attempt to buy at cap-1 and verify revert

### Economic Failures

**1. First-block sniping**
- **Scenario**: Sophisticated user buys large portion of supply immediately at launch, capturing most upside
- **Severity**: Acceptable (not protocol failure, but damages "fair launch" perception)
- **Mitigation options** (not in v1):
  - Per-address buy caps (sybil-vulnerable)
  - Commit-reveal (adds latency and trust)
  - Time-sliced issuance (complexity)
- **V1 stance**: No mitigation; protocol is permissionless

**2. Creator sets pathological curve parameters**
- **Scenario**: Creator chooses `basePrice = 1000 sats`, `priceIncrement = 1 sat`, `supplyCap = 21M` → entire supply costs trivial amount, instant dump
- **Severity**: Critical (reputational damage to ecosystem)
- **Mitigation**:
  - Protocol enforces minimum parameter bounds (see Section 7)
  - Frontend shows "risk score" derived from parameters (e.g., "very low price increment")
  - Metadata registry allows creator disclosures
  - No "featured launches" without manual review

**3. Low liquidity post-issuance**
- **Scenario**: Token sells out on curve, but no secondary market exists
- **Severity**: Acceptable (not protocol's responsibility)
- **Mitigation**: Frontend can suggest/link to compatible DEXs on Midl

### UX Failures

**1. Indexer lag causes stale UI pricing**
- **Scenario**: User sees "current price: 1000 sats", but on-chain price is 2000 sats due to recent buy
- **Severity**: Acceptable if mitigated
- **Mitigation**:
  - Frontend reads directly from contract via RPC (not just indexer)
  - Show "last updated: [timestamp]" on UI
  - Display confirmation states ("pending", "confirmed")

**2. Transaction failure without clear feedback**
- **Scenario**: Buy reverts due to slippage, but user doesn't understand why
- **Severity**: Acceptable if mitigated
- **Mitigation**:
  - Frontend displays estimated vs minimum tokens clearly
  - Show revert reason from Blockscout
  - Provide "Transaction failed: slippage exceeded" in UI

**3. Wallet compatibility issues**
- **Scenario**: Wallet doesn't support Midl intents or Bitcoin transaction construction
- **Severity**: Critical (blocks user access)
- **Mitigation**:
  - Test with Xverse and other Midl-supported wallets
  - Provide wallet compatibility warning on frontend
  - Document required wallet features (BIP322, PSBT support)

### Adversarial Behaviors

**1. MEV via transaction ordering**
- **Scenario**: Validator or sophisticated user observes pending buy transactions and front-runs with own buy
- **Severity**: Acceptable (inherent to validator sequencing)
- **Mitigation**:
  - Transparent: document that ordering is validator-controlled
  - Curve design limits single-transaction MEV (linear pricing reduces profit from front-running)
  - No protocol-level solution in v1

**2. Fake metadata/social engineering**
- **Scenario**: Attacker creates launch with misleading name/description to impersonate legitimate project
- **Severity**: Critical (reputational risk)
- **Mitigation**:
  - Protocol is permissionless; cannot prevent fake launches
  - Frontend can implement curation/verification badges (separate from protocol)
  - Metadata registry allows linking official socials/websites

**3. Spam launches**
- **Scenario**: Attacker deploys thousands of worthless tokens to pollute launch registry
- **Severity**: Acceptable (does not break protocol)
- **Mitigation**:
  - Charge minimum BTC fee for launch creation (e.g., 50k sats)
  - Frontend filters by volume/activity, not just creation timestamp

---

## 12. Security Model

### What the protocol protects against

1. **Unauthorized minting**: Only BondingCurvePrimaryMarket can mint tokens
2. **Supply cap violation**: Impossible to mint beyond `supplyCap` (enforced in token contract)
3. **Price manipulation**: Curve pricing is deterministic and immutable
4. **Parameter tampering**: Curve parameters are immutable post-deployment
5. **Fee siphoning**: Creator fee rate is fixed at deployment; cannot be changed

### What the protocol does NOT protect against

1. **BTC custody loss**: Midl validators control TSS vaults; protocol assumes validator honesty
2. **Ordering manipulation**: Validators sequence transactions; protocol does not enforce ordering fairness
3. **Token value**: Protocol issues tokens but does not guarantee post-issuance value
4. **Creator rugpull**: Creator can sell tokens immediately; no vesting enforced
5. **Social engineering**: Fake launches, misleading metadata

### Known attack classes

**1. Reserve accounting exploits (Odin.fun-class)**
- **Description**: In systems with sell logic, attackers exploit mismatches between contract-assumed reserves and actual BTC held
- **Relevance to MidlLaunch**: Not applicable in v1 (no sell); critical concern for future versions
- **Reference**: Odin.fun hack (August 2025) - pricing logic vulnerability in AMM migration

**2. First-block sniping**
- **Description**: Sophisticated users buy large portions at launch via speed/bot advantages
- **Relevance**: Possible; not mitigated in v1
- **Stance**: Accepted as emergent behavior; no fairness enforcement

**3. Parameter abuse**
- **Description**: Creators choose pathological curves to trick users
- **Relevance**: Partially mitigated by protocol bounds; still requires user diligence
- **Stance**: Enforce minimum bounds; rely on UI/curation for additional filtering

### Assumptions that must be audited

1. **Curve math correctness**: `calculatePurchaseReturn()` must be formally verified or extensively fuzz-tested
2. **ERC20 compliance**: Token contract must pass standard ERC20 test suites
3. **Access control**: Only authorized contracts can mint
4. **Immutability**: Critical parameters cannot be changed post-deployment
5. **Event completeness**: All state changes emit events for indexer correctness

---

## 13. Indexing & Data Availability

### Required events

**LaunchFactory**
```solidity
event LaunchCreated(
    address indexed tokenAddress,
    address indexed curveAddress,
    address indexed creator,
    bytes32 intentId,  // Correlation field per Section 9.8
    uint256 supplyCap,
    uint256[] curveParams
);
```

**BondingCurvePrimaryMarket**
```solidity
event TokensPurchased(
    address indexed buyer,
    bytes32 intentId,  // Correlation field per Section 9.8
    uint256 btcAmount,
    uint256 tokenAmount,
    uint256 newTotalSupply,
    uint256 newPrice
);

event LaunchFinalized(
    address indexed tokenAddress,
    uint256 finalSupply,
    uint256 totalBTCDepositedSats  // Updated per Section 7B.5
);
```

**Note:** Event timestamps are derived from block metadata, not emitted as separate fields (per Section 9.8).

### Canonical vs derived data

**Canonical (on-chain, trustless):**
- Token supply: `LaunchToken.totalSupply()`
- Current price: `BondingCurvePrimaryMarket.getCurrentPrice()`
- Curve parameters: `BondingCurvePrimaryMarket.curveParams`
- Total BTC deposited: `BondingCurvePrimaryMarket.totalBTCDepositedSats` (per Section 7B.5)

**Derived (indexer-computed, trust-minimized):**
- "Percent sold": `totalSupply / supplyCap * 100`
- "Launch progress": Time since creation, recent buy volume
- "Trending launches": Activity ranking over time window

### Indexer trust assumptions

Indexers (frontend or third-party) are trusted to:
- Correctly parse contract events
- Not omit or fabricate events
- Provide accurate "derived" metrics
- Maintain availability

Users can verify canonical data by:
- Directly calling contract view functions via RPC
- Inspecting Blockscout event logs

### Reorg / lag handling

**Bitcoin reorgs:**
- Rare (depth > 6 blocks is negligible)
- If occurs: Midl state commitment may revert
- Frontend should show "unconfirmed" for < N confirmations (where N is defined per Section 4: N=1 for staging, N=3-6 for mainnet)

**Indexer lag:**
- Indexer may be behind RPC by 1-10 blocks
- Frontend should:
  - Display "last indexed block" timestamp
  - Allow "refresh from chain" to bypass indexer
  - Show visual indicator if data is stale (e.g., > 5 minutes old)

---

## 14. Upgrade & Governance Philosophy

### Upgrade strategy

**V1 design: Immutable core**
- LaunchToken and BondingCurvePrimaryMarket are non-upgradeable
- Once deployed, curve logic and parameters are fixed
- Rationale: Maximize trust minimization; avoid admin key risk

**LaunchFactory: Versioned upgrades**
- Factory can be upgraded to new versions (e.g., FactoryV2)
- Old launches remain on previous factory version
- New launches use new factory
- No forced migration of existing launches

**If proxies are required (future consideration):**
- Must use transparent proxy pattern (EIP-1967)
- Upgrade authority must be multi-sig or time-locked governance
- Upgrade authority address must be published on-chain and in documentation
- Upgrades must be announced with minimum 7-day notice

### Admin powers (v1)

**Scope clarification:** Admin powers affect ONLY LaunchFactory functions, NEVER buy() execution on existing curves.

**LaunchFactory admin can:**
- Update `protocolFeeRate` (within bounds, e.g., max 2%, applies only to NEW launches)
- Update `feeRecipient` address
- Pause new launch creation (emergency only; does NOT halt trading on existing curves)

**LaunchFactory admin cannot:**
- Alter existing launches or their parameters
- Mint tokens in any launch
- Drain user funds from any curve or vault
- Change curve logic on deployed contracts
- Halt buy() operations on active curves

**Admin key management:**
- V1: Controlled by deployment team multi-sig (3-of-5)
- Future: Transfer to governance contract or DAO

### Governance explicitly deferred

MidlLaunch v1 has no on-chain governance mechanism. Future versions may add:
- Token-weighted voting on protocol fee changes
- Community curation of "verified launches"
- Treasury management for protocol fees

These are non-binding future possibilities; v1 assumes centralized admin with explicit constraints.

---

## 15. Out-of-Scope & Future Extensions (Non-Binding)

The following are explicitly not part of v1 but may be considered in future versions:

**Secondary market AMM:**
- Automated liquidity migration from bonding curve to AMM pool
- Requires formal invariant specification and audit
- Must solve BTC reserve accounting guarantees

**Sell-side curve logic:**
- Allow users to sell tokens back to curve for BTC
- Requires symmetric settlement guarantees and reserve proofs
- High priority for v2 if technically feasible

**Anti-bot mechanisms:**
- Per-address buy caps
- Commit-reveal for fair launch
- Time-sliced issuance windows

**Cross-chain interoperability:**
- Bridge launched tokens to other chains
- Out of scope for Bitcoin-native focus

**Governance token:**
- Protocol governance via token-weighted voting
- Requires separate governance framework design

**Advanced curve types:**
- Exponential, logarithmic, or custom curve families
- Requires additional testing and parameter bound analysis

**Rune integration:**
- Launch tokens as Runes simultaneously with ERC20
- Depends on Midl's Rune SDK maturity

---

## 16. Open Questions & Explicit Risks

### Open questions (must resolve before mainnet)

**Note:** Section 9 (Settlement Model) resolves several previously open questions about `msg.value` semantics, refund behavior, and finality definitions. The following remain open:

1. **Midl system fee policy (Section 9.3 dependency)**
   - Does Midl deduct system fees before crediting `msg.value`?
   - Must be documented by Midl team for each deployment environment
   - Frontend quoting depends on this clarification

2. **Fee payout settlement mechanism (Section 9.6 dependency)**
   - Are protocol/creator fees paid via RBTs in same block, periodic sweeps, or manual claims?
   - Must be specified per deployment environment
   - Staging may defer; mainnet must commit to policy

3. **intentId availability in EVM context (Section 9.8 dependency)**
   - Can Solidity contracts access FBT txid directly?
   - If not, must implement `intentId = keccak256(...)` pattern in calldata
   - Requires validation with Midl SDK and validator implementation

4. **Wallet compatibility matrix**
   - Which wallets support Midl intent signing (BIP322)?
   - Are there wallet-specific quirks (e.g., PSBT versions, signature formats)?
   - Must test with Xverse, Unisat, others per Section 4.3

5. **Operational SLAs for mainnet (Section 4.2 dependency)**
   - Maximum execution latency (FBT confirmation → Midl execution)
   - Maximum refund settlement time (revert → RBT visible)
   - RPC/Blockscout uptime targets
   - Must be contractually committed by validator set before mainnet

6. **Legal/regulatory classification**
   - Are launched tokens securities in relevant jurisdictions?
   - Does permissionless issuance expose protocol to liability?
   - Requires legal review per Section 4.3

### Explicit risks (cannot be eliminated)

**1. Midl validator centralization**
- **Risk**: Validators can censor transactions, reorder for MEV, or halt execution
- **Mitigation**: None in protocol layer; trust assumption
- **Disclosure**: Must be stated in all user-facing documentation

**2. Bitcoin consensus change**
- **Risk**: Future Bitcoin soft/hard fork could affect Midl's Bitcoin integration
- **Mitigation**: None; protocol depends on Bitcoin stability
- **Disclosure**: Systemic risk inherent to Bitcoin-native applications

**3. Smart contract bugs**
- **Risk**: Undiscovered vulnerability in curve math or access control
- **Mitigation**: Extensive testing, audits, bug bounty
- **Disclosure**: All smart contracts carry inherent risk

**4. Economic attack via parameter selection**
- **Risk**: Creators choose parameters that trick unsophisticated users
- **Mitigation**: Enforce protocol bounds; rely on UI/curation
- **Disclosure**: Users must verify parameters before buying

**5. No secondary market liquidity**
- **Risk**: Tokens sell out on curve but have no trading venue
- **Mitigation**: Encourage DEX integration; not protocol responsibility
- **Disclosure**: Protocol provides issuance, not liquidity guarantees

---

## 17. PRD Lock-In Summary

This PRD locks the following decisions for MidlLaunch v1:

### Locked architectural decisions

1. **Scope: Primary issuance only**
   - No sell logic
   - No AMM migration
   - Buy-side bonding curve exclusively

2. **Curve family: Linear only**
   - `Price(supply) = basePrice + (supply * priceIncrement)` (per Section 8)
   - Pricing in sats per whole token (per Section 7B.3)
   - Parameter bounds enforced in LaunchFactory

3. **Trust model: Explicit validator trust**
   - BTC custody is trust-minimized via Midl validators/TSS vaults (per Section 9.2)
   - Not trustless; not self-custodial
   - Settlement model fully specified (Section 9)

4. **Immutability: Core contracts non-upgradeable**
   - LaunchToken and BondingCurvePrimaryMarket have no admin upgrade
   - LaunchFactory versioned (can deploy new versions)

5. **No fairness enforcement**
   - No anti-bot, anti-snipe, per-address caps in v1
   - Permissionless issuance

### Locked technical specifications

1. **ERC20 compatibility**
   - LaunchToken implements standard ERC20 interface
   - 18 decimals (standard per Section 7B.2)

2. **Unit conventions**
   - All BTC amounts in satoshis (Section 7B.1)
   - Token base unit = 1e18 (Section 7B.2)
   - Curve pricing = sats per whole token (Section 7B.3)

3. **Event schema with correlation**
   - `LaunchCreated`, `TokensPurchased`, `LaunchFinalized` event structures (see Section 13)
   - All events include `intentId` correlation field (per Section 9.8)
   - Breaking changes require new factory version

4. **Settlement proof requirements**
   - Every launch and buy must produce verifiable proof on Bitcoin and Midl explorers (per Section 9.8)
   - Environment-specific endpoints defined in Section 4

5. **Parameter bounds**
   - See Section 8 for curve parameter constraints
   - Enforced in LaunchFactory; cannot be bypassed

### What cannot change without breaking protocol upgrade

1. **Event schemas**: Changing event structure breaks indexers
2. **ERC20 interface**: Changing token interface breaks composability
3. **Curve pricing logic**: Changing price function breaks user expectations
4. **Supply cap enforcement**: Removing cap enforcement breaks trust model
5. **Minting authorization**: Changing who can mint tokens breaks security model

### What can change in minor updates

1. **Frontend UI/UX**: Cosmetic changes, improved error messages
2. **Indexer implementation**: Backend improvements to derived data computation
3. **LaunchFactory fee rates**: Within documented bounds (e.g., max 2% protocol fee)
4. **Documentation and disclosures**: Clarifications, additional warnings

---

## Technical Appendix A: Linear Curve Closed-Form Solution

> **Purpose:** Provide the exact mathematical formulation and implementation guidance for the linear bonding curve to eliminate implementation ambiguity.

### A.1 Problem Statement

Given:
- Current token supply: `S` (in base units, i.e., total minted tokens × 1e18)
- User deposits: `B` satoshis
- Curve parameters:
  - `P₀` = basePrice_sats_per_token (sats required to mint 1 whole token at supply = 0)
  - `k` = priceIncrement_sats_per_token_per_token (sats added per whole token minted)

Find: `ΔT` (tokens to mint in base units)

### A.2 Mathematical Derivation

**Step 1: Define price function**

Price per whole token as a function of supply in whole tokens:
```
P(s) = P₀ + k·s
```

where `s = S / 1e18` (supply in whole tokens)

**Step 2: Integral formulation**

The BTC required to mint from supply `s` to supply `s + Δt` (in whole tokens):
```
B = ∫[s to s+Δt] P(σ) dσ
B = ∫[s to s+Δt] (P₀ + k·σ) dσ
B = [P₀·σ + k·σ²/2] evaluated from s to s+Δt
B = P₀·Δt + k·(Δt² + 2s·Δt)/2
```

Rearranging:
```
k·Δt²/2 + (P₀ + k·s)·Δt - B = 0
```

This is a quadratic equation in Δt.

**Step 3: Closed-form solution**

Using quadratic formula with:
- `a = k/2`
- `b = P₀ + k·s`
- `c = -B`

```
Δt = [-b + √(b² - 4ac)] / 2a
Δt = [-(P₀ + k·s) + √((P₀ + k·s)² + 2k·B)] / k
```

(We take the positive root since Δt > 0)

### A.3 Implementation in Solidity

**Recommended approach (per Section 7B.4):**

```solidity
function calculatePurchaseReturn(uint256 btcInSats, uint256 currentSupplyBaseUnits)
    public view returns (uint256 tokensOutBaseUnits)
{
    // Convert supply to whole tokens for pricing calculation
    uint256 s = currentSupplyBaseUnits / 1e18;  // Integer division (floor)
    
    // Quadratic coefficients (all in sats)
    uint256 b = basePrice_sats_per_token + (priceIncrement_sats_per_token_per_token * s);
    
    // Calculate discriminant: b² + 2k·B
    // Note: we use b² + 2k·B instead of b² - 4ac because c is negative
    uint256 discriminant = (b * b) + (2 * priceIncrement_sats_per_token_per_token * btcInSats);
    
    // Calculate sqrt(discriminant)
    uint256 sqrtDiscriminant = sqrt(discriminant);  // Use library sqrt
    
    // Calculate Δt in whole tokens: (sqrt - b) / k
    // Note: sqrtDiscriminant >= b always (discriminant >= b²), so no underflow
    uint256 deltaT_wholeTokens = (sqrtDiscriminant - b) / priceIncrement_sats_per_token_per_token;
    
    // Convert back to base units
    tokensOutBaseUnits = deltaT_wholeTokens * 1e18;
}

// Helper: integer square root (Newton's method or Babylonian method)
function sqrt(uint256 x) internal pure returns (uint256 y) {
    if (x == 0) return 0;
    uint256 z = (x + 1) / 2;
    y = x;
    while (z < y) {
        y = z;
        z = (x / z + z) / 2;
    }
}
```

### A.4 Bounds and Overflow Analysis

**Input bounds (enforced in LaunchFactory per Section 8):**
- `basePrice_sats_per_token`: [1,000, 1,000,000] sats
- `priceIncrement_sats_per_token_per_token`: [1, 10,000] sats
- `supplyCap`: [1M, 21M] whole tokens

**Maximum values:**
- Max supply `s`: 21M tokens
- Max `b`: 1,000,000 + (10,000 × 21,000,000) = 210,001,000,000 sats
- Max `b²`: ~4.41 × 10²² 
- Max discriminant: ~4.41 × 10²² (dominates over 2k·B term)

**Overflow safety:**
- Solidity 0.8+ reverts on overflow
- `b²` and discriminant fit in uint256 (max ~10⁷⁷)
- Square root result fits in uint128
- All intermediate calculations safe

**Rounding direction:**
- Integer division `s = S / 1e18` rounds down (favors protocol)
- Final conversion `Δt × 1e18` is exact for whole token quantities
- User receives `floor(calculated tokens)` (favors protocol)

### A.5 Monotonicity Proof (Informal)

For linear curve, price strictly increases with supply:
```
∂P/∂s = k > 0 (since k >= 1 per bounds)
```

Therefore:
- For fixed BTC deposit B, higher starting supply s yields fewer tokens Δt
- For fixed starting supply s, higher BTC deposit B yields more tokens Δt

This guarantees no arbitrage via curve manipulation.

### A.6 Gas Cost Analysis

**Operations:**
- 2 multiplications (b calculation)
- 3 multiplications (discriminant)
- 1 sqrt (iterative, ~200-500 gas depending on input size)
- 2 divisions
- 1 final multiplication

**Total estimated gas: ~2,000-3,000 gas** (constant time, independent of input size)

This is well within acceptable limits for a core pricing function.

---

## Document Version Control

**Version 1.1** - February 8, 2026
- **MAJOR UPDATE**: Added normative Settlement Model (Section 9)
- **MAJOR UPDATE**: Added Canonical Unit Conventions (Section 7B)
- Added Deployment Environments section (Section 4) with staging/mainnet parameters
- Clarified admin scope to only affect factory, never buy() execution
- Updated all event schemas with intentId correlation field
- Renamed `totalBTCRaised` to `totalBTCDepositedSats` for precision
- Resolved ambiguities around `msg.value`, refund semantics, and finality
- Updated Open Questions to reflect Settlement Model resolutions

**Version 1.0** - February 8, 2026 (initial draft)
- Initial production-grade PRD
- Scope locked to buy-side bonding curve
- Linear curve family only
- No sell or AMM migration in v1
- Explicit trust model documentation

**Review required before mainnet:**
- Smart contract audit (external firm) - must validate curve math and settlement assumptions
- Settlement model validation with Midl team (confirm Sections 9.3, 9.5, 9.6 semantics)
- Legal review (regulatory classification)
- Wallet compatibility testing (Xverse, Unisat minimum; validate BIP322 support)
- Stress testing on staging environment (minimum 100 simulated launches, 1000 buys, intentional reverts)
- Operational SLA definition per Section 4.2

---

**END OF DOCUMENT**
