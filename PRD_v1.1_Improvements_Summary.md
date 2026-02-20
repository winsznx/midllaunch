# MidlLaunch PRD v1.1 - Critical Improvements Summary

## What Changed and Why It Matters

This document summarizes the transformation from v1.0 (directionally sound but ambiguous) to v1.1 (production-credible specification).

---

## Major Additions

### 1. Section 9: Settlement Model (Normative) - **THE CRITICAL ADDITION**

**What it fixes:**
- Eliminates all `msg.value` hand-waving
- Defines exact semantics for how Bitcoin transactions become EVM executions
- Specifies refund behavior when transactions revert
- Establishes finality definitions across three layers (Bitcoin inclusion, Midl execution, economic finality)

**Key specifications:**
- **FBT (Funding BTC Transaction)**: User-signed Bitcoin tx that transfers BTC to TSS vault
- **Intent**: Signed virtual transaction with reference to FBT txid
- **vBTC**: Internal accounting representation; validators virtually mint during execution
- **RBT (Return BTC Transaction)**: Validator-produced tx that returns funds on revert
- **msg.value semantics**: Explicitly defined as `(FBT_sats_to_vault) - (execution-level deductions)`
- **Refund guarantee**: Trust-minimized (depends on validator liveness/slashing)

**Why critical:**
Without this section, implementers would make conflicting assumptions about what happens when:
- User signs BTC tx but execution reverts
- Multiple intents are batched in one BTC tx
- System fees are deducted before/after execution
- Settlement finality is reached

### 2. Section 7B: Canonical Unit Conventions (Normative)

**What it fixes:**
- Eliminates the "18 decimals" footgun (are prices per base unit or per whole token?)
- Defines exactly what `totalBTCDepositedSats` means
- Specifies slippage protection in correct units

**Key decisions:**
- All BTC amounts in satoshis (uint256)
- Token base unit = 1e18 per whole token
- **Pricing convention: sats per whole token** (matches user mental model)
- `totalBTCDepositedSats` = cumulative credited sats (NOT cryptographic reserve proof)

**Why critical:**
The original PRD said "supplyCap: [1M, 21M] using 18 decimals" - does that mean 1M base units or 1M tokens? One interpretation is 10^18 off the other. This section locks that down.

### 3. Section 4: Deployment Environments

**What it fixes:**
- Splits staging vs mainnet requirements explicitly
- Defines environment-specific parameters (confirmation thresholds, fee policies, SLAs)
- Lists transition requirements (audit, legal, testing)

**Key specifications:**
- **Staging**: N=1 confirmation, simplified fees, no SLA
- **Mainnet**: N=3-6 confirmations, full fee settlement, published SLAs

**Why critical:**
The original header said "Target: Midl Mainnet" but hardcoded staging URLs everywhere. This resolves that contradiction.

### 4. Technical Appendix A: Closed-Form Curve Solution

**What it provides:**
- Exact mathematical derivation (integral → quadratic → solution)
- Concrete Solidity implementation with sqrt helper
- Overflow analysis and gas cost estimation
- Monotonicity proof

**Why critical:**
The original Section 7 said "iterative approximation or closed-form quadratic solution" without specifying which. This creates implementation degrees of freedom that auditors will reject. The appendix locks the exact formula.

---

## Major Corrections

### Corrected Ambiguities

1. **Admin scope now explicit** (Section 14):
   - Admin can ONLY affect LaunchFactory (fee rates, pause new launches)
   - Admin CANNOT affect buy() on existing curves
   - Original version implied admin could "pause" without specifying what that means

2. **Reserve accounting renamed** (Section 7B.5):
   - `totalBTCRaised` → `totalBTCDepositedSats`
   - Explicitly NOT a reserve proof; just on-chain accounting of credited sats
   - Original implied this was provably backed; now clearly states it's trust-minimized

3. **Event schemas updated** (Section 13):
   - All events now include `intentId` correlation field
   - Removed redundant timestamp emission (derive from block)
   - This enables FBT txid ↔ Midl tx correlation per Section 9.8

4. **Failure modes updated** (Section 11):
   - Refund behavior now references Section 9.5 normative semantics
   - Reserve accounting mismatch severity clarified (non-critical for buy-only v1)

### Resolved Open Questions

**Section 16 now reflects:**
- Settlement semantics (RESOLVED by Section 9)
- Refund behavior (RESOLVED by Section 9)
- Finality definitions (RESOLVED by Section 9)

**Still open (require Midl team input):**
- System fee policy (gross vs net msg.value)
- Fee payout mechanism (RBT timing)
- intentId availability in EVM context
- Operational SLAs for mainnet

---

## Internal Consistency Improvements

### Cross-References Now Accurate

- All settlement references point to Section 9
- All unit convention references point to Section 7B
- All environment parameters reference Section 4
- Event schemas reference Section 13
- Curve math references Section 8 + Appendix A

### Terminology Standardized

- "BTC raised" → "BTC deposited" (more accurate)
- "totalBTCRaised" → "totalBTCDepositedSats" (precise unit + meaning)
- "msg.value receives BTC" → "msg.value represents vBTC credited" (correct Midl semantics)
- "refunded via Midl" → "refund via RBT per Section 9.5" (normative reference)

---

## What This Enables

### For Implementers

1. **Unambiguous buy() function**: Appendix A provides exact code
2. **Clear settlement expectations**: Section 9 defines what happens on success/failure
3. **Testable specifications**: Can verify monotonicity, overflow safety, gas costs

### For Auditors

1. **Normative sections** (9, 7B, Appendix A) are contract specifications
2. **Trust boundaries explicitly stated** throughout
3. **No hand-waving**: Every claim is either enforced on-chain or marked as trust-minimized

### For Mainnet Deployment

1. **Section 4.3 checklist**: Concrete requirements before promotion
2. **Section 16 dependencies**: Clear what needs Midl team confirmation
3. **Section 9 SLAs**: Validator commitments must be documented

---

## Comparison: v1.0 vs v1.1

| Aspect | v1.0 | v1.1 |
|--------|------|------|
| **Settlement semantics** | Hand-wavy ("payable receives BTC") | Normative (Section 9: FBT, Intent, vBTC, RBT) |
| **Unit conventions** | Ambiguous ("using 18 decimals") | Explicit (7B: sats, base units, pricing per whole token) |
| **msg.value meaning** | Assumed Ethereum-like | Defined as vBTC credited (9.3) |
| **Refund behavior** | "or refunded via Midl" | Trust-minimized RBT per validator policy (9.5) |
| **Admin powers** | Vague ("pause creation") | Scoped (affects factory only, never buy()) |
| **Curve math** | "Iterative or closed-form" | Closed-form with exact formula (Appendix A) |
| **Environment split** | Conflated staging/mainnet | Explicit staging vs mainnet (Section 4) |
| **Event correlation** | Missing | intentId in all events (9.8, Section 13) |
| **Open questions** | 5 unresolved | 3 resolved by Section 9, 6 remaining with dependencies noted |

---

## PRD Readiness Verdict

### v1.0 Status
**Verdict:** Good hackathon spec, NOT production-ready
**Blockers:** Settlement ambiguity, unit conventions unclear, admin scope undefined

### v1.1 Status
**Verdict:** Production-credible, pending Midl team validation
**Remaining dependencies:**
1. Midl team must confirm Section 9 settlement model accuracy
2. Environment-specific fee policy must be defined
3. Operational SLAs must be committed for mainnet

**What's locked:**
- Curve math (closed-form, Appendix A)
- Unit conventions (Section 7B)
- Trust model (explicit throughout)
- Settlement expectations (Section 9)

---

## Next Steps

### For Qualifier (Staging)

1. Implement contracts per Section 7, Appendix A
2. Use Section 4.1 staging parameters
3. Validate Section 9 settlement model with Midl SDK
4. Deliver per Section 10 transaction flows

### Before Mainnet

1. Complete Section 4.3 checklist:
   - External audit (focus on Appendix A math + Section 9 assumptions)
   - Midl team validation of Section 9
   - Legal review
   - Stress testing (100 launches, 1000 buys, intentional reverts)

2. Resolve Section 16 open questions:
   - Get Midl fee policy
   - Commit to fee payout mechanism
   - Test intentId correlation
   - Define operational SLAs

3. Final PRD lock with all dependencies resolved

---

## Acknowledgment

These improvements directly address the rigorous judge/auditor review feedback:
- Settlement semantics gap (FIXED by Section 9)
- Unit conventions footgun (FIXED by Section 7B)
- Admin model ambiguity (FIXED in Section 14)
- Curve math under-specification (FIXED by Appendix A)
- Environment mismatch (FIXED by Section 4)

The PRD is now production-credible while remaining achievable for a 14-day qualifier.
