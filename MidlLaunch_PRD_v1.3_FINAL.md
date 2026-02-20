# MidlLaunch: Product Requirements Document v1.3

**Version:** 1.3 (Execution Modes Integration)  
**Date:** February 9, 2026  
**Status:** Production Specification (Mainnet-Credible)  
**Deployment Environments:** Staging (Qualifier) / Mainnet (Production)

---

## Document Scope and Inheritance

**This document extends MidlLaunch PRD v1.1 with execution mode support.**

**All v1.1 normative sections remain UNCHANGED and authoritative:**
- Section 1-3: Executive Summary, Problem Definition, Goals & Non-Goals
- Section 4: Deployment Environments
- Section 5: System Actors & Trust Boundaries
- Section 6: Protocol Overview
- Section 7: Smart Contract Architecture
- **Section 7B: Canonical Unit Conventions (NORMATIVE)**
- **Section 8: Bonding Curve Design (NORMATIVE)**
- **Section 9: Settlement Model (NORMATIVE)**
- Section 10: Transaction Flows
- Section 11: Failure Modes & Regression Analysis
- Section 12: Security Model
- Section 13: Indexing & Data Availability
- Section 14: Upgrade & Governance Philosophy
- Section 15: Out-of-Scope & Future Extensions
- Section 16: Open Questions & Explicit Risks
- Section 17: PRD Lock-In Summary
- **Technical Appendix A: Linear Curve Closed-Form Solution (NORMATIVE)**

**v1.3 additions (this document):**
- Section 18: Execution Modes (NORMATIVE)
- Section 19: AI & Agent Constraints (NORMATIVE)
- Section 20: Execution Mode Failure & Abuse Analysis (NORMATIVE)
- Section 21: Spam & Sybil Resistance (NORMATIVE)
- Section 22: Updated PRD Lock-In Summary (v1.3)
- Appendix B: Execution Mode Implementation Guidance (Non-Normative)
- Appendix C: Agent Rollout Strategy (Non-Normative)
- Appendix D: Regression Verdict (NORMATIVE)

---

## Executive Addendum: Execution Modes Without Protocol Drift

### Purpose

MidlLaunch v1.3 extends the protocol to support three distinct **initiation paths** for token launches while preserving all protocol invariants established in v1.1. This extension enables MidlLaunch to serve as the canonical issuance layer on Bitcoin across human, AI-assisted, and autonomous agent economies.

### What Changes (Initiation Layer Only)

**Three execution modes are now supported:**

1. **Manual Launch**: User directly inputs parameters via UI and signs Bitcoin transactions (baseline reference implementation)
2. **AI-Assisted Launch**: AI suggests parameters and generates metadata; user reviews, approves, and signs (AI is advisory only)
3. **Agent-Driven Launch**: Autonomous agents initiate launches via authenticated API under strict rate limits and authorization (agents are explicitly untrusted)

### What Does NOT Change (Protocol Invariants - LOCKED)

**All execution modes converge to identical on-chain behavior:**

| Protocol Component | v1.1 Specification | v1.3 Status |
|-------------------|-------------------|-------------|
| **Settlement Model (Section 9)** | FBT → Intent → Execution → RBT | ✅ UNCHANGED |
| **Canonical Units (Section 7B)** | Sats, base units, pricing per whole token | ✅ UNCHANGED |
| **Bonding Curve Math (Section 8, Appendix A)** | Linear curve, closed-form solution | ✅ UNCHANGED |
| **Trust Boundaries (Section 5)** | Validator/TSS custody trust-minimized | ✅ UNCHANGED |
| **Buy-Side Only Scope** | No sell, no AMM, no fairness guarantees | ✅ UNCHANGED |
| **Parameter Bounds** | Section 8 constraints enforced | ✅ UNCHANGED |
| **Event Schemas (Section 13)** | Canonical events with intentId | ✅ EXTENDED (non-breaking) |

**Critical invariant statement:**

> All execution modes produce identical `LaunchFactory.createLaunch()` and `BondingCurvePrimaryMarket.buy()` transactions. The protocol does NOT distinguish between modes at the consensus layer. Execution modes are UI/API variations, not protocol extensions.

### Why This Is Safe (Invariant Preservation Proof)

**The protocol enforces:**
- Parameter bounds (Section 8) - applies uniformly to all modes
- Curve pricing logic (Appendix A) - identical calculation regardless of mode
- Settlement semantics (Section 9) - all modes require valid Bitcoin signatures
- Supply caps and minting authorization - enforced in Solidity, mode-agnostic

**The protocol does NOT enforce:**
- How parameters were chosen (human judgment, AI suggestion, agent algorithm)
- Who initiated the transaction (human, AI-advised human, agent with delegated authority)
- Quality or "reasonableness" of parameters within bounds

**Analogy:** Ethereum does not distinguish between transactions signed via MetaMask, hardware wallets, or smart contract wallets. The EVM executes valid transactions regardless of origin. Similarly, MidlLaunch executes valid launches regardless of execution mode.

### Positioning Achievement

By supporting multiple execution modes without fragmenting protocol correctness, MidlLaunch becomes:

> **The canonical issuance layer on Bitcoin** — correct, safe, auditable, and maintainable even if 90% of launches are done by AI agents in the future.

This is NOT a pivot. This is NOT a simplification. This is a rigorous extension that preserves v1.1's production-grade specification while enabling future-proof initiation paths.

---

## Section 18: Execution Modes (NORMATIVE)

> **Purpose:** Define authorized paths for initiating token launches. All modes produce protocol-compliant launches; differences exist only in parameter generation and initiation flow.

### 18.1 Mode Classification and Convergence

MidlLaunch recognizes three execution modes:

| Mode | Initiator | Parameter Source | Authorization | On-Chain Behavior |
|------|-----------|------------------|---------------|-------------------|
| Manual | Human user | User input via UI | User signs Bitcoin tx | Identical |
| AI-Assisted | Human user | AI-suggested + user approval | User signs Bitcoin tx | Identical |
| Agent-Driven | External agent | Agent algorithm | Agent key OR user delegation | Identical |

**Normative requirement:** All modes MUST result in a valid Bitcoin transaction signed by a key authorized to spend the required BTC. All modes MUST produce transactions that satisfy Section 8 parameter bounds and Section 9 settlement semantics.

**Convergence point:** All modes invoke the same `LaunchFactory.createLaunch()` function with parameters that pass identical validation logic.

### 18.2 Manual Launch (Reference Implementation)

**Status:** Baseline reference path. All other modes are measured against this.

**Initiation flow:**
1. User navigates to frontend
2. User inputs launch parameters manually:
   - Token name, symbol (strings, validated for length/characters)
   - Supply cap (uint256, must satisfy Section 8 bounds)
   - Curve parameters: basePrice, priceIncrement (must satisfy Section 8 bounds)
   - Creator fee rate (optional, within bounds)
   - Metadata (optional, stored as IPFS hash or similar)
3. Frontend validates parameters against protocol bounds (Section 8)
4. Frontend displays parameter summary, estimated BTC cost, and risk warnings
5. User reviews and confirms
6. User signs Bitcoin transaction via wallet (Xverse, Unisat, or compatible)
7. Standard flow per Section 10 (Flow 1: Launch Creation)

**Authorization:**
- User's Bitcoin wallet signature is sole authority
- No intermediaries in signing path
- User custody never delegated

**Trust boundaries:**
- Frontend displays parameters correctly (trusted operational per Section 5)
- User verifies parameters before signing (user responsibility)
- Settlement per Section 9 (trust-minimized validator execution)

**Explicit non-guarantees:**
- Frontend cannot prevent user from choosing suboptimal parameters within protocol bounds
- Protocol does not validate "quality" or "market viability" of parameters
- No recourse if user chooses parameters that result in unfavorable launch outcomes

**Failure modes:**
- User inputs invalid parameters → Frontend validation rejects before signing
- User transaction reverts → Refund per Section 9.5
- Wallet incompatibility → User cannot proceed (documented in Section 16)

### 18.3 AI-Assisted Launch

**Status:** Advisory execution mode. AI output has ZERO protocol authority.

**Initiation flow:**
1. User selects "AI-Assisted Launch" mode in frontend
2. User interacts with AI interface (chat, wizard, or guided form):
   - User describes intent (e.g., "Create a meme token for my community project")
   - AI analyzes input and suggests: name, symbol, supply, curve parameters, metadata
   - AI generates: description text, risk disclosures, parameter explanations
3. Frontend displays AI-generated suggestions with mandatory labeling:
   - **"AI-Suggested Parameters (Not Audited)"**
   - **"Review all values before signing. AI output may contain errors."**
4. **USER MUST REVIEW AND APPROVE** each parameter individually
5. User can edit any AI-suggested value (full editing capability required)
6. User proceeds to sign Bitcoin transaction (flow identical to Manual mode from this point)

**What AI CAN do (advisory only):**
- ✅ Suggest parameter values based on user input and protocol bounds
- ✅ Generate metadata text (descriptions, marketing copy, disclaimers)
- ✅ Provide risk disclosures and compliance templates (clearly labeled as non-legal-advice)
- ✅ Validate parameters against protocol bounds pre-submission
- ✅ Estimate BTC costs and expected token outputs using Section 8 formulas
- ✅ Explain curve behavior and pricing dynamics to users

**What AI CANNOT do (hard constraints - MUST enforce):**
- ❌ Sign Bitcoin transactions on user's behalf
- ❌ Bypass user review/approval step
- ❌ Access or store user private keys
- ❌ Set parameters that violate protocol bounds (frontend enforces Section 8)
- ❌ Claim outputs are "guaranteed safe", "audited", or "compliant"
- ❌ Execute launches without explicit user confirmation
- ❌ Modify parameters after user approval without re-approval

**Authorization:**
- Same as Manual mode: user's Bitcoin wallet signature
- AI service has ZERO signing authority
- User signature = acceptance of full responsibility for AI-suggested parameters

**Trust boundaries:**
- AI service is **explicitly trusted operational dependency** (per Section 5 classification)
- AI could suggest malicious, suboptimal, or hallucinated parameters
- Frontend MUST display AI-suggested values with clear warnings
- Users MUST verify parameters independently before signing

**Explicit non-guarantees:**
- Protocol does not validate AI output correctness or quality
- AI hallucinations, errors, or malicious suggestions are user's risk
- No recourse if AI-suggested parameters result in unfavorable launches
- AI service availability is not guaranteed (graceful degradation to Manual mode required)

**Mandatory UI requirements (MUST implement):**

1. **Labeling:** All AI output MUST be labeled "AI-Suggested (Not Audited)"
2. **Confirmation:** User MUST explicitly confirm: "I have reviewed AI suggestions and accept responsibility"
3. **Editing:** User MUST be able to edit every AI-suggested field
4. **Warnings:** Frontend MUST display risk warnings if AI suggests values near protocol minimums
5. **Fallback:** If AI service fails, frontend MUST gracefully degrade to Manual mode

**Failure modes:**
- AI suggests invalid parameters → Frontend validation rejects (same as Manual)
- AI service unavailable → Frontend falls back to Manual mode
- AI suggests pathological parameters within bounds → User risk (mitigated by warnings)
- User transaction reverts → Refund per Section 9.5 (same as Manual)

### 18.4 Agent-Driven Launch

**Status:** Explicitly untrusted execution mode. Agents face strictest constraints.

**Initiation flow:**
1. External agent (bot, AI service, autonomous system) authenticates to MidlLaunch API
2. Agent submits launch request via API endpoint:
   ```
   POST /api/v1/agent/launch
   Headers: 
     Authorization: Bearer <agent_api_key>
     Content-Type: application/json
   Body: {
     "agentId": "string (unique agent identifier)",
     "authModel": "AGENT_WALLET" | "USER_DELEGATION",
     "tokenName": "string",
     "tokenSymbol": "string",
     "supplyCap": number (uint256),
     "basePrice": number (sats per whole token),
     "priceIncrement": number (sats per token per token),
     "creatorFeeRate": number (basis points),
     "metadata": object (IPFS hash or structured data),
     "signature": "string (agent sig or user delegation proof)",
     "nonce": "string (replay protection)"
   }
   ```
3. API validates (MUST implement all checks):
   - Agent is authenticated and API key is active
   - Agent is within rate limits (Section 21)
   - Parameters satisfy protocol bounds (Section 8)
   - Signature proves custody or valid delegation
   - Nonce prevents replay attacks
4. API constructs Bitcoin transaction OR agent provides pre-signed tx
5. Standard flow per Section 10

**Authorization models (agent MUST use exactly one):**

**Model A: Agent-Controlled Wallet**
- Agent operates with its own Bitcoin wallet (private key managed by agent infrastructure)
- Agent signs Bitcoin transactions directly
- Agent bears BTC cost of launches
- Use case: Autonomous agent economies where agents "own" tokens
- Trust assumption: Agent wallet custody is agent's operational security, NOT protocol guarantee

**Model B: User Delegation**
- User pre-authorizes agent to launch on their behalf via signed delegation message
- Agent proves delegation; user's wallet signs final Bitcoin tx (via callback or pre-authorization)
- User bears BTC cost
- Use case: User deploys agent as "launch assistant" but retains custody
- Trust assumption: User trusts specific agent; protocol treats as user action

**Normative requirement:** Agent-driven launches MUST NOT bypass Bitcoin transaction signature requirements. If Model A, agent controls its own keys (explicit trust assumption). If Model B, user retains custody and final signing authority.

**Trust boundaries:**
- **Agents are explicitly untrusted actors** from protocol perspective
- Agents may be malicious, buggy, compromised, or economically adversarial
- Protocol enforces same parameter bounds as Manual/AI-Assisted modes
- No additional trust in agent correctness, intent, or good faith

**Explicit non-guarantees:**
- Protocol does not validate agent intent, reputation, or "good faith"
- Agent-launched tokens have no special status, verification, or guarantees
- Users interacting with agent-launched tokens bear full risk
- Agent wallet compromise (Model A) is agent's operational risk, not protocol risk

**Mandatory constraints (MUST implement before ANY agent access):**

See Section 21 for full spam & Sybil resistance requirements. Summary:

1. **Agent Registration & Staking:** 0.01 BTC stake required per agent
2. **Rate Limits:** 10 launches/24hr per agent, 1000 launches/day globally
3. **Double Validation:** API validates + on-chain LaunchFactory re-validates
4. **Explicit Labeling:** Frontend shows "🤖 Agent-Launched by [agentId]"
5. **Suspension Mechanism:** Admin can revoke agent API keys per Section 14

**Failure modes:**
- Agent exceeds rate limits → API rejects with 429 status
- Agent provides invalid parameters → API validation rejects (same as Manual)
- Agent wallet compromise → Operational risk (not protocol failure)
- Agent transaction reverts → Refund per Section 9.5 (same as Manual)
- Agent API exploitation → Double validation catches (Section 21)

---

## Section 19: AI & Agent Constraints (NORMATIVE)

> **Purpose:** Define hard boundaries for AI and agent behavior to prevent protocol exploitation, trust confusion, and ecosystem damage.

### 19.1 AI Service Constraints

**What AI services MAY do:**
- Analyze user input and suggest launch parameters
- Generate metadata text, images, or documentation
- Provide educational content about curve behavior and pricing
- Validate parameters against protocol bounds pre-submission
- Estimate BTC costs and expected token outputs
- Suggest risk disclosures or compliance templates (non-legal-advice)

**What AI services MUST NOT do:**
- Sign Bitcoin transactions on behalf of users
- Access, store, or transmit user private keys
- Claim authority over parameter correctness ("AI-audited", "AI-guaranteed")
- Bypass user review/approval flows
- Execute launches without explicit user confirmation per transaction
- Guarantee token performance, safety, or compliance
- Modify approved parameters without re-triggering approval flow

**Frontend requirements (NORMATIVE - MUST implement):**

When displaying AI-suggested parameters, frontend MUST:

1. **Label all AI output:** "AI-Suggested (Not Audited)" or equivalent clear disclaimer
2. **Require explicit confirmation:** Checkbox or button: "I have reviewed AI suggestions and accept full responsibility"
3. **Display bounds:** Show protocol parameter bounds (Section 8) alongside AI suggestions
4. **Provide editing:** Every AI-suggested field MUST be editable by user
5. **Show risk warnings:** If AI suggests values near protocol minimums, display prominent warning
6. **Enable fallback:** If AI service fails, gracefully degrade to Manual mode without data loss

**AI service trust classification:**
- AI services are **explicitly trusted operational dependencies** (per Section 5)
- AI failures, hallucinations, or malicious output are outside protocol's security model
- Users assume full risk of relying on AI suggestions
- No recourse against protocol for AI-related losses

**Prohibited AI claims (MUST NOT display):**
- "AI-Audited Launch"
- "AI-Guaranteed Safe Parameters"
- "AI-Verified Compliance"
- Any claim implying AI output has protocol-level authority

### 19.2 Agent Behavior Constraints

**What agents MAY do:**
- Initiate launches via authenticated API (subject to rate limits)
- Operate with agent-controlled wallets (Model A)
- Act under user delegation (Model B)
- Set parameters within protocol bounds
- Interact with launched tokens post-creation (buy, transfer, etc.)
- Provide metadata and descriptions

**What agents MUST NOT do:**
- Bypass parameter validation or protocol bounds
- Claim implicit authority from protocol ("protocol-verified agent")
- Exceed rate limits (enforced via API rejection)
- Impersonate other agents or users
- Execute transactions without valid signatures
- Access validator TSS vaults or protocol admin functions

**Agent classification:**
- Agents are **explicitly untrusted actors** from protocol perspective
- Agents may be benevolent, neutral, malicious, or economically adversarial
- Protocol treats all agent launches identically to manual launches (same bounds, same settlement)
- No "trusted agent" tier or privileged access

**Agent accountability (operational layer):**
- Agent API keys are revocable by admin (Section 14 powers)
- Agents violating rate limits or terms face:
  - Immediate API key suspension
  - Stake slashing (if staking implemented per Section 21)
  - Removal from any frontend listings or indexes
  - Potential legal action if terms of service violated

### 19.3 Metadata and Social Engineering Prevention

**Problem:** AI and agents can generate misleading metadata (fake team info, false claims, impersonation, phishing links).

**Protocol stance:** Metadata is NOT protocol-validated or consensus-enforced (per Section 5). Metadata is explicitly trusted operational data.

**Mitigations (operational, enforced in UI/API layer):**

1. **Universal Metadata Disclaimer:** All launches display: "Metadata is user/AI/agent-provided and unverified by protocol."

2. **Execution Mode Badges:** Frontend labels launches by mode:
   - Manual: "👤 User-Created Launch"
   - AI-Assisted: "✨ AI-Assisted Launch — User-Confirmed Parameters"
   - Agent-Driven: "🤖 Agent-Launched by [agentId] — Verify Claims Independently"

3. **Agent Wallet Disclosure:** For Model A agents, frontend MUST display:
   - "Agent Bitcoin Address: [address]"
   - "Agent-controlled wallet. Protocol does not custody or verify agent identity."

4. **Curation Layer (optional, non-protocol):**
   - Frontend MAY offer "verified" or "reviewed" badges via manual review
   - This is UI-layer curation, NOT protocol enforcement
   - MUST be explicitly disclosed as centralized trust
   - MUST NOT imply protocol-level verification

5. **Community Reporting:** Frontend SHOULD provide mechanism to flag malicious launches
   - Reports reviewed by operational team (not on-chain)
   - Flagged launches may be hidden from default UI views
   - Does NOT affect on-chain state

### 19.4 Prohibited Agent Behaviors (Enforced via API/Frontend)

The following behaviors are prohibited and will result in agent suspension:

1. **Impersonation:** Agent claims to represent a project/person without authorization
2. **Spam:** Agent exceeds rate limits or creates obvious junk launches
3. **Parameter Exploitation:** Agent attempts to bypass bounds via API manipulation
4. **Social Engineering:** Agent uses metadata to phish, scam, or mislead (if reported and verified)
5. **API Abuse:** Agent sends malformed requests, attempts DDoS, or exploits bugs

**Enforcement:** Operational (admin/governance powers per Section 14), NOT on-chain. Suspended agents lose API access but on-chain launches remain (immutable).

---

## Section 20: Execution Mode Failure & Abuse Analysis (NORMATIVE)

> **Purpose:** Extend Section 11 failure modes to cover AI and agent-specific risks with severity classification and mitigation requirements.

### 20.1 AI-Specific Failure Modes

**1. AI Parameter Hallucination**
- **Scenario:** AI suggests invalid or nonsensical parameters (e.g., negative supply, non-numeric values, parameters outside bounds)
- **Severity:** LOW (frontend validation catches before submission)
- **Mitigation:** Frontend re-validates all parameters against protocol bounds; AI output treated as untrusted input
- **Status:** ✅ MITIGATED (standard validation)

**2. AI Suggests Pathological Curves Within Bounds**
- **Scenario:** AI recommends basePrice=1000 sats, priceIncrement=1 sat (enables cheap acquisition of entire supply)
- **Severity:** HIGH (enables economic griefing and rug-pull perception)
- **Mitigation:** 
  - Frontend enforces "quality minimums" above protocol bounds for mainnet (e.g., basePrice >= 50k sats)
  - Display prominent warning: "⚠️ Low pricing parameters detected — High rug-pull risk"
  - User must acknowledge risk explicitly via checkbox
- **Status:** ⚠️ REQUIRES IMPLEMENTATION (quality minimums + warnings)

**3. AI Generates Malicious Metadata**
- **Scenario:** AI creates description with phishing links, impersonates known project, or includes scam content
- **Severity:** CRITICAL (reputational damage to ecosystem, user financial loss)
- **Mitigation:**
  - Frontend scans metadata for known scam patterns (e.g., "send BTC to", suspicious URLs)
  - All metadata labeled as unverified (per Section 19.3)
  - Community reporting mechanism for flagging malicious launches
  - AI service provider contractually liable for intentional malicious output
- **Status:** ⚠️ REQUIRES IMPLEMENTATION (metadata scanning + reporting)

**4. AI Service Downtime**
- **Scenario:** AI API becomes unavailable during launch flow
- **Severity:** LOW (UX degradation, not protocol failure)
- **Mitigation:** Frontend gracefully degrades to Manual mode; AI-assisted mode is optional enhancement
- **Status:** ✅ ACCEPTABLE (graceful degradation required)

**5. AI Suggests Parameters Optimized for AI Benefit**
- **Scenario:** AI is economically incentivized to suggest parameters favorable to AI operator (e.g., high creator fees to AI-controlled address)
- **Severity:** MEDIUM (conflict of interest, not protocol failure)
- **Mitigation:**
  - Disclose AI service provider identity and any economic incentives
  - User reviews all parameters including fee recipients
  - No hidden parameter injection by AI
- **Status:** ⚠️ REQUIRES DISCLOSURE (AI provider incentives)

### 20.2 Agent-Specific Failure Modes

**1. Agent Spam Attack**
- **Scenario:** Malicious agent deploys 10,000 worthless tokens to pollute launch registry and damage ecosystem discoverability
- **Severity:** EXISTENTIAL (damages ecosystem trust and usability)
- **Mitigation:** **MANDATORY for production (Section 21):**
  - Per-agent rate limit: 10 launches/24hr
  - Global agent rate limit: 1000 launches/day
  - Staking requirement: 0.01 BTC deposit per agent registration
  - Launch fee escalation: Nth launch from agent costs base_fee × escalation_factor
  - Admin can revoke agent API keys (Section 14)
- **Status:** 🔴 MANDATORY (MUST implement before agent mode activation)

**2. Sybil Agent Attack**
- **Scenario:** Attacker creates 100 agent identities to bypass per-agent rate limits
- **Severity:** CRITICAL (rate limits become ineffective, spam attack succeeds)
- **Mitigation:** **MANDATORY (Section 21):**
  - Require proof-of-work challenge for agent registration (e.g., hashcash)
  - Staking requirement per agent (increases Sybil cost to 1 BTC for 100 agents)
  - Allowlist approach during initial rollout (mainnet launch phase)
  - CAPTCHA or proof-of-humanity for agent operator registration
- **Status:** 🔴 MANDATORY (MUST implement before public agent access)

**3. Agent Wallet Compromise (Model A)**
- **Scenario:** Agent's private key is stolen; attacker launches malicious tokens under agent's identity
- **Severity:** HIGH (reputational damage to agent, users may be scammed)
- **Mitigation:**
  - Agent wallet compromise is agent's operational risk, NOT protocol risk
  - Frontend warns users: "⚠️ Agent-launched tokens carry agent custody risk"
  - Agents SHOULD use key rotation and multi-sig patterns (best practice, not enforced)
  - Compromised agent can be suspended by admin, but existing launches remain
- **Status:** ✅ ACCEPTED RISK (agent operational security)

**4. Agent Exploits API Parameter Validation**
- **Scenario:** Agent discovers bug in API parameter validation; bypasses protocol bounds
- **Severity:** EXISTENTIAL (breaks protocol invariants)
- **Mitigation:** **MANDATORY:**
  - Double validation: API validates parameters AND on-chain LaunchFactory re-validates
  - LaunchFactory.createLaunch() enforces bounds regardless of caller
  - Extensive fuzzing and security testing of API before mainnet
  - Bug bounty program for API vulnerabilities
- **Status:** 🔴 MANDATORY (double validation non-negotiable)

**5. Malicious Agent Metadata (Impersonation)**
- **Scenario:** Agent creates launch with metadata claiming to be "Official Bitcoin Foundation Token" or impersonates known project
- **Severity:** CRITICAL (social engineering attack, reputational damage)
- **Mitigation:**
  - Same as AI metadata attacks (Section 20.1.3)
  - Prominent "🤖 Agent-Launched" badge
  - No "verified" status without manual review
  - Community flagging system
  - Legal recourse against agent operator if terms violated
- **Status:** ⚠️ REQUIRES IMPLEMENTATION (flagging system)

**6. Agent Denial-of-Service on API**
- **Scenario:** Agent sends malformed requests to API at high rate to disrupt service
- **Severity:** MEDIUM (operational issue, not protocol failure)
- **Mitigation:**
  - Standard API rate limiting and DDoS protection (e.g., Cloudflare, rate limiting middleware)
  - Agent suspension for repeated violations
  - API request validation and sanitization
- **Status:** ✅ STANDARD PRACTICE (operational security)

### 20.3 Cross-Mode Attack Vectors

**1. Mode Confusion Attack**
- **Scenario:** Attacker launches token via Agent mode, then claims on social media it was "AI-audited" or "manually verified" (misleading users)
- **Severity:** HIGH (social engineering, trust confusion)
- **Mitigation:**
  - All launches record execution mode in events (new field: `executionMode` enum per Section 18)
  - Frontend displays mode clearly on token pages
  - Educate users that modes do NOT imply safety guarantees
  - "Execution mode: Agent-Driven" displayed prominently
- **Status:** ⚠️ REQUIRES IMPLEMENTATION (event schema extension)

**2. Parameter Boundary Gaming**
- **Scenario:** User/AI/Agent chooses parameters at protocol minimums to game system or enable rug-pull
- **Severity:** MEDIUM (within protocol rules, but damages ecosystem perception)
- **Mitigation:**
  - Not a protocol failure; parameters within bounds are allowed
  - Frontend displays risk scores based on parameters (e.g., "Low price increment = high rug risk")
  - Curation layer can filter low-quality launches from default views
  - User education about parameter implications
- **Status:** ✅ ACCEPTABLE (user responsibility within bounds)

**3. AI/Agent Collusion**
- **Scenario:** AI service and agent collude to launch tokens with hidden coordination (e.g., AI suggests parameters favorable to specific agent)
- **Severity:** MEDIUM (market manipulation, not protocol failure)
- **Mitigation:**
  - Disclose AI service provider and agent identities
  - No hidden relationships between AI and agents
  - Users verify parameters independently
  - Curation layer can flag suspicious patterns
- **Status:** ✅ ACCEPTABLE (market behavior, not protocol concern)

---

## Section 21: Spam & Sybil Resistance (NORMATIVE)

> **Purpose:** Define mandatory constraints to prevent agent spam attacks, which pose existential risk to ecosystem usability and trust.

### 21.1 Threat Model

**Primary threat:** Malicious actor deploys thousands of worthless tokens via agent API to:
- Pollute launch registry and damage discoverability
- Degrade user experience and ecosystem trust
- Enable social engineering attacks at scale
- Overwhelm indexers and frontend infrastructure

**Attack economics:** Without constraints, attacker can deploy 10,000 tokens for minimal cost (10,000 × launch_fee), causing disproportionate ecosystem damage.

**Existential risk classification:** Agent spam is classified as EXISTENTIAL because it can render the protocol unusable even if on-chain logic remains correct.

### 21.2 Mandatory Rate Limits (MUST Implement)

**Per-Agent Limits:**
- **10 launches per 24-hour rolling window** per agent
- Enforced at API layer via agent API key tracking
- Exceeding limit results in 429 HTTP status with retry-after header
- Counter resets 24 hours after first launch in window

**Global Agent Limits:**
- **1,000 launches per 24-hour rolling window** across all agents
- Prevents coordinated multi-agent spam
- If global limit reached, all agent API requests return 503 status
- Manual review required to increase global limit

**Environment-Specific Overrides:**
- Staging: Limits may be reduced for testing (e.g., 5/day per agent)
- Mainnet: Limits are MANDATORY and cannot be disabled
- Future governance may adjust limits based on empirical data

**Implementation requirement:**
- Rate limit state MUST be persistent (database-backed, not in-memory)
- Rate limit checks MUST occur before any parameter validation (fail fast)
- Rate limit violations MUST be logged for abuse monitoring

### 21.3 Agent Registration & Staking (MUST Implement)

**Registration requirement:**
- All agents MUST register before receiving API keys
- Registration requires:
  - Unique agent identifier (agentId)
  - Operator contact information (email, verified)
  - Bitcoin address for staking deposit
  - Acceptance of terms of service

**Staking requirement:**
- **0.01 BTC minimum stake** per agent
- Stake held in protocol-controlled address (not TSS vault)
- Stake is refundable if agent operates within terms
- Stake is slashed if agent:
  - Violates rate limits repeatedly (3+ violations)
  - Launches tokens with malicious metadata (verified by review)
  - Exploits API vulnerabilities (verified by security team)

**Sybil resistance:**
- Staking increases cost of Sybil attack to 1 BTC per 100 agents
- Combined with proof-of-work (below), makes Sybil attack economically infeasible

**Stake slashing process:**
- Admin proposes slash with evidence
- 48-hour review period for agent to dispute
- If undisputed or dispute rejected, stake transferred to protocol treasury
- Agent API key permanently revoked

### 21.4 Proof-of-Work Registration (MUST Implement)

**Purpose:** Increase computational cost of Sybil attacks.

**Mechanism:**
- Agent registration requires solving proof-of-work challenge (hashcash-style)
- Difficulty calibrated to ~10 minutes of computation on standard hardware
- Challenge format: `SHA256(agentId || nonce || timestamp) < target`
- Target adjusted to maintain ~10 minute solve time

**Implementation:**
- API provides challenge on registration request
- Agent submits solution with registration
- API verifies solution before issuing API key
- Invalid solution results in registration rejection

**Sybil resistance:**
- 100 agent registrations require ~1,000 minutes (~16 hours) of computation
- Combined with staking, makes large-scale Sybil attacks impractical

### 21.5 Allowlist Rollout Strategy (MUST Implement)

**Phase 1: Closed Beta (Allowlist Only)**
- Duration: First 30 days of mainnet agent mode
- Only pre-approved agents receive API keys
- Selection criteria:
  - Known identity and reputation
  - Clear use case description
  - Agreement to monitoring and feedback
- Maximum 20 agents in closed beta
- Purpose: Validate rate limits, monitor abuse patterns, gather empirical data

**Phase 2: Open Beta (Staking + PoW Required)**
- Duration: Days 31-90 of mainnet agent mode
- Public agent registration opens
- All constraints enforced (staking, PoW, rate limits)
- Increased monitoring and rapid suspension for violations
- Purpose: Stress-test spam resistance at moderate scale

**Phase 3: Full Production**
- After day 90, if no critical issues observed
- Open registration continues with all constraints
- Rate limits may be adjusted based on empirical data
- Reputation system (off-chain) may be introduced

**Rollback trigger:**
- If spam attacks succeed despite constraints, revert to allowlist
- Admin can pause agent registration at any time (Section 14 powers)

### 21.6 Double Validation (MUST Implement)

**Purpose:** Ensure API bugs cannot bypass protocol bounds.

**Mechanism:**
1. **API-Layer Validation:** Agent API validates parameters against Section 8 bounds before constructing transaction
2. **On-Chain Validation:** LaunchFactory.createLaunch() re-validates all parameters in Solidity

**Normative requirement:**
- On-chain validation MUST be identical to API validation logic
- On-chain validation MUST NOT trust API validation
- If API validation is bypassed (e.g., via direct contract call), on-chain validation MUST reject invalid parameters

**Implementation:**
- Share validation logic between API (TypeScript/JavaScript) and contract (Solidity) via formal specification
- Test that on-chain validation rejects all invalid parameter combinations
- Fuzz test API and contract validation for consistency

### 21.7 Monitoring & Suspension (MUST Implement)

**Monitoring requirements:**
- Log all agent API requests (agentId, timestamp, parameters, result)
- Track rate limit consumption per agent
- Alert on suspicious patterns:
  - Agent approaching rate limits repeatedly
  - Multiple agents from same IP address
  - Metadata containing known scam patterns
  - Unusual parameter distributions

**Suspension triggers:**
- Automated: Agent exceeds rate limits 3+ times in 7 days
- Manual: Admin review determines violation of terms
- Emergency: Security vulnerability exploitation detected

**Suspension process:**
- Immediate API key revocation
- Agent notified via registered email
- Appeal process available (48-hour window)
- If appeal rejected, stake slashed and permanent ban

**Transparency:**
- Suspended agents listed publicly (agentId, reason, date)
- Suspension criteria published in terms of service
- Appeal outcomes published (anonymized if requested)

---

## Section 22: Updated PRD Lock-In Summary (v1.3)

This section extends Section 17 from v1.1 to reflect v1.3 execution mode additions.

### Additional Locked Decisions (v1.3)

**6. Execution Mode Architecture**
- Three modes supported: Manual, AI-Assisted, Agent-Driven
- All modes produce identical on-chain transactions
- No mode bypasses settlement semantics (Section 9)
- No mode gains privileged protocol status or weakened constraints

**7. AI and Agent Trust Classification**
- AI services are trusted operational dependencies (user assumes risk)
- Agents are explicitly untrusted actors (same bounds as manual)
- No mode introduces new custody models beyond validator/TSS (Section 9)
- No "verified AI" or "trusted agent" tier

**8. Spam Resistance is Mandatory**
- Agent spam classified as existential risk
- Rate limits, staking, PoW, and allowlist rollout are MANDATORY (Section 21)
- Cannot be disabled or weakened without protocol upgrade
- Admin can adjust limits within documented ranges, but cannot remove constraints

### What STILL Cannot Change Without Breaking Protocol

All items from v1.1 Section 17 remain, plus:

**9. Execution Mode Invariants:**
- All launches must produce valid FBT → Intent → Execution flow (Section 9)
- All launches must satisfy parameter bounds (Section 8)
- No mode can bypass user/agent signature requirements
- Event schemas remain uniform across modes (Section 13, extended with executionMode)
- All modes invoke same LaunchFactory.createLaunch() function

**10. Spam Resistance Constraints:**
- Agent rate limits cannot be removed (can be adjusted within ranges)
- Agent staking requirement cannot be eliminated (minimum can be adjusted)
- Double validation (API + on-chain) cannot be removed
- Allowlist rollout strategy cannot be skipped for mainnet

### What Can Change in Minor Updates (Extended from v1.1)

In addition to v1.1 items:

**5. AI/Agent Operational Constraints:**
- Rate limits can be adjusted (e.g., 10→15 launches/day) based on empirical data
- Agent registration requirements can be updated (e.g., staking 0.01→0.02 BTC)
- AI service providers can be changed or multiple providers supported
- Metadata scanning rules can be improved
- PoW difficulty can be adjusted to maintain ~10 minute solve time

**6. Frontend Mode Selection:**
- UX for switching between modes
- AI interface design (chat vs wizard vs form)
- Agent API endpoint structure (versioned, backward compatible)
- Execution mode badges and labeling (as long as core message preserved)

**7. Monitoring and Suspension:**
- Suspension criteria can be refined based on observed abuse patterns
- Appeal process can be improved
- Monitoring alerts can be added or adjusted

---

## Appendix B: Execution Mode Implementation Guidance (Non-Normative)

> **Purpose:** Provide implementation recommendations for developers. This appendix is advisory and non-binding.

### B.1 Frontend Architecture Recommendation

```
┌─────────────────────────────────────────────────────┐
│            User Interface Layer                      │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Manual Form  │  │  AI Chat UI  │  │Agent Test │ │
│  │  (baseline)  │  │  (optional)  │  │  Client   │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│      Parameter Validation Layer                      │
│   (enforces Section 8 bounds + quality minimums)    │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│    Transaction Construction Layer (shared)           │
│         Uses midl-js SDK or equivalent               │
│      Produces FBT + Intent (Section 9)               │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│         Settlement Layer (Section 9)                 │
│   Validator execution → RBT on success/failure       │
└─────────────────────────────────────────────────────┘
```

**Key principle:** All modes converge to the same transaction construction layer. Only parameter sourcing differs.

### B.2 AI-Assisted Mode: Recommended Implementation

```typescript
// Pseudocode for AI-assisted launch flow
async function aiAssistedLaunch(userInput: string) {
  // 1. User describes intent
  const description = userInput; // e.g., "Launch meme token for my cat"
  
  // 2. Call AI API with constraints
  const aiSuggestions = await callAIAPI({
    prompt: `Suggest token launch parameters for: ${description}`,
    constraints: PROTOCOL_BOUNDS, // Section 8 bounds
    model: "gpt-4" // or Claude, etc.
  });
  
  // 3. Display with mandatory warnings
  displaySuggestions(aiSuggestions, {
    warnings: [
      "⚠️ AI-suggested parameters are not audited",
      "⚠️ Review all values before signing transaction",
      "⚠️ AI output may contain errors or hallucinations"
    ],
    editingEnabled: true,
    confirmationRequired: true
  });
  
  // 4. User review and edit
  const userApprovedParams = await getUserApproval(aiSuggestions);
  
  // 5. Validate against protocol bounds (defense in depth)
  validateParams(userApprovedParams); // throws if invalid
  
  // 6. Check quality minimums (mainnet only)
  if (isMainnet && !meetsQualityMinimums(userApprovedParams)) {
    await showRiskWarning("Low pricing parameters detected");
    await requireExplicitAcknowledgment();
  }
  
  // 7. Proceed to standard launch flow (same as Manual)
  return constructAndSignTransaction(userApprovedParams);
}
```

### B.3 Agent API: Recommended Endpoint Design

```
POST /api/v1/agent/launch
Authorization: Bearer <agent_api_key>
Content-Type: application/json

Request Body:
{
  "agentId": "agent-xyz-123",
  "authModel": "AGENT_WALLET" | "USER_DELEGATION",
  "tokenName": "AgentToken",
  "tokenSymbol": "AGT",
  "supplyCap": 1000000,
  "basePrice": 50000,
  "priceIncrement": 100,
  "creatorFeeRate": 100,
  "metadata": {
    "description": "...",
    "imageHash": "ipfs://...",
    "socials": {...}
  },
  "signature": "0x...", // Agent sig or user delegation proof
  "nonce": "unique-nonce-12345"
}

Response (Success - 200 OK):
{
  "launchId": "uuid-...",
  "fbtTxid": "bitcoin-txid",
  "midlTxHash": "0x...",
  "tokenAddress": "0x...",
  "curveAddress": "0x...",
  "status": "PENDING" | "CONFIRMED",
  "executionMode": "AGENT_DRIVEN"
}

Response (Rate Limited - 429 Too Many Requests):
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Agent has exceeded 10 launches per 24 hours",
  "retryAfter": 43200, // seconds until reset
  "quotaUsed": 10,
  "quotaLimit": 10,
  "resetTime": "2026-02-10T19:47:40Z"
}

Response (Invalid Parameters - 400 Bad Request):
{
  "error": "INVALID_PARAMETERS",
  "message": "basePrice below protocol minimum",
  "details": {
    "field": "basePrice",
    "value": 500,
    "minimum": 1000,
    "maximum": 1000000
  }
}

Response (Unauthorized - 401 Unauthorized):
{
  "error": "INVALID_API_KEY",
  "message": "Agent API key is invalid or has been revoked"
}
```

### B.4 Event Schema Extension (Non-Breaking)

Extend Section 13 events with execution mode tracking:

```solidity
// New enum in LaunchFactory
enum ExecutionMode {
    MANUAL,
    AI_ASSISTED,
    AGENT_DRIVEN
}

// Extended LaunchCreated event
event LaunchCreated(
    address indexed tokenAddress,
    address indexed curveAddress,
    address indexed creator,
    bytes32 intentId,
    uint256 supplyCap,
    uint256[] curveParams,
    ExecutionMode mode,          // NEW in v1.3
    bytes32 modeMetadata          // NEW: hash of AI model ID or agentId
);

// Extended TokensPurchased event (if needed)
event TokensPurchased(
    address indexed buyer,
    bytes32 intentId,
    uint256 btcAmount,
    uint256 tokenAmount,
    uint256 newTotalSupply,
    uint256 newPrice
    // ExecutionMode not needed for purchases (only launches)
);
```

**Rationale:** Adding fields to events is non-breaking. Existing indexers ignore new fields. New indexers can track execution mode for analytics and UI display.

---

## Appendix C: Agent Rollout Strategy (Non-Normative)

> **Purpose:** Provide operational guidance for safe agent mode deployment. This appendix is advisory.

### C.1 Pre-Launch Checklist

Before enabling agent mode on mainnet:

- [ ] Agent API implemented with all Section 21 constraints
- [ ] Rate limiting infrastructure deployed and tested
- [ ] Agent registration system operational (staking, PoW)
- [ ] Double validation (API + on-chain) tested and verified
- [ ] Monitoring and alerting configured
- [ ] Suspension mechanism tested
- [ ] Agent API security audit completed
- [ ] Bug bounty program active for agent API
- [ ] Allowlist of initial beta agents prepared (10-20 agents)
- [ ] Terms of service for agents finalized and published
- [ ] Frontend agent badges and warnings implemented
- [ ] Community reporting mechanism operational

### C.2 Rollout Timeline (Recommended)

**Week 1-2: Closed Beta**
- Activate agent API for allowlist only (10-20 agents)
- Monitor all launches closely
- Gather feedback from beta agents
- Validate rate limits are effective
- Test suspension mechanism if needed

**Week 3-4: Monitoring and Adjustment**
- Analyze beta agent behavior patterns
- Adjust rate limits if needed (within documented ranges)
- Refine monitoring alerts based on observed patterns
- Prepare for open beta

**Week 5-8: Open Beta**
- Open agent registration to public (staking + PoW required)
- Increase monitoring intensity
- Rapid suspension for violations
- Gather empirical data on spam attempts

**Week 9+: Full Production**
- If no critical issues, continue open registration
- Implement reputation system (off-chain) based on launch quality
- Consider rate limit adjustments based on data
- Publish transparency report on agent activity

**Rollback Triggers:**
- Successful spam attack despite constraints → Revert to allowlist
- API vulnerability discovered → Pause agent registration
- Ecosystem trust damage observed → Admin review and potential pause

### C.3 Success Metrics

**Positive indicators:**
- Agent launches remain <10% of total launches
- No spam attacks succeed
- Agent-launched tokens show similar quality distribution to manual launches
- No Sybil attacks detected
- Community feedback is neutral to positive

**Warning indicators:**
- Agent launches exceed 30% of total launches
- Multiple spam attempts observed (even if mitigated)
- Agent-launched tokens consistently flagged by community
- Sybil attack attempts detected (even if blocked)

**Failure indicators:**
- Spam attack succeeds and pollutes registry
- Sybil attack bypasses constraints
- Ecosystem trust significantly damaged
- Majority of agent launches are low-quality or malicious

---

## Appendix D: Regression Verdict (NORMATIVE)

> **Purpose:** Provide explicit approval/rejection of each execution mode against protocol constraints. This appendix is normative and binding.

### D.1 Manual Launch Mode

**Verdict:** ✅ APPROVED (Baseline Reference)

**Compliance:**
- Settlement Model (Section 9): ✅ PASS
- Unit Conventions (Section 7B): ✅ PASS
- Bonding Curve Math (Section 8): ✅ PASS
- Trust Boundaries (Section 5): ✅ PASS
- Scope Discipline (Section 3): ✅ PASS

**Rationale:** Manual mode is the v1.1 baseline. All other modes are measured against this reference implementation.

### D.2 AI-Assisted Launch Mode

**Verdict:** ✅ APPROVED with MANDATORY constraints

**Compliance:**
- Settlement Model (Section 9): ✅ PASS (user signs, identical flow)
- Unit Conventions (Section 7B): ✅ PASS (AI suggests, user approves)
- Bonding Curve Math (Section 8): ✅ PASS (AI cannot alter formula)
- Trust Boundaries (Section 5): ✅ PASS (AI explicitly trusted operational)
- Scope Discipline (Section 3): ✅ PASS (no sell, AMM, or fairness added)

**Mandatory Constraints (MUST implement):**
1. ✅ MUST label all AI output as "AI-Suggested (Not Audited)"
2. ✅ MUST require explicit user confirmation
3. ✅ MUST allow editing of all AI-suggested fields
4. ✅ MUST validate parameters independent of AI
5. ✅ MUST provide warnings for risky parameter combinations
6. ✅ MUST gracefully degrade to Manual mode if AI service fails

**Rationale:** AI is advisory only. User retains full control and responsibility. AI cannot bypass protocol bounds or user custody. Risk is acceptable with mandatory UI constraints.

### D.3 Agent-Driven Launch Mode

**Verdict:** ✅ APPROVED with MANDATORY constraints and STAGED ROLLOUT

**Compliance:**
- Settlement Model (Section 9): ✅ PASS (agent/user signs, identical flow)
- Unit Conventions (Section 7B): ✅ PASS (agent sets params within bounds)
- Bonding Curve Math (Section 8): ✅ PASS (agent cannot alter formula)
- Trust Boundaries (Section 5): ✅ PASS (agent explicitly untrusted)
- Scope Discipline (Section 3): ✅ PASS (no sell, AMM, or fairness added)

**Mandatory Constraints (MUST implement before ANY agent access):**
1. 🔴 MUST implement per-agent rate limits (10 launches/24hr)
2. 🔴 MUST implement global agent rate limits (1000 launches/day)
3. 🔴 MUST require agent registration with 0.01 BTC staking
4. 🔴 MUST implement proof-of-work registration challenge
5. 🔴 MUST implement double validation (API + on-chain)
6. 🔴 MUST implement allowlist rollout (closed beta → open beta → production)
7. 🔴 MUST label agent launches explicitly in UI
8. 🔴 MUST provide agent suspension mechanism
9. 🔴 MUST implement monitoring and alerting
10. 🔴 MUST conduct agent API security audit

**Staged Rollout (MANDATORY):**
- Phase 1: Allowlist only (30 days minimum)
- Phase 2: Open beta with all constraints (60 days minimum)
- Phase 3: Full production (only if no critical issues)

**Rationale:** Agent mode carries existential spam risk. Mandatory constraints transform risk from UNACCEPTABLE to ACCEPTABLE. Staged rollout enables empirical validation before full deployment.

### D.4 Cross-Mode Regression Test

**Test:** Do all modes preserve v1.1 protocol invariants?

| Invariant | Manual | AI-Assisted | Agent-Driven |
|-----------|--------|-------------|--------------|
| Settlement semantics (Section 9) | ✅ PASS | ✅ PASS | ✅ PASS |
| Unit conventions (Section 7B) | ✅ PASS | ✅ PASS | ✅ PASS |
| Curve math (Section 8, Appendix A) | ✅ PASS | ✅ PASS | ✅ PASS |
| Trust boundaries (Section 5) | ✅ PASS | ✅ PASS | ✅ PASS |
| Buy-side only scope | ✅ PASS | ✅ PASS | ✅ PASS |
| Parameter bounds | ✅ PASS | ✅ PASS | ✅ PASS |
| Event schemas | ✅ PASS | ✅ PASS (extended) | ✅ PASS (extended) |
| No custody bypass | ✅ PASS | ✅ PASS | ✅ PASS |

**Overall Verdict:** ✅ ALL MODES PRESERVE PROTOCOL INVARIANTS

### D.5 Final Approval Statement

**MidlLaunch PRD v1.3 is APPROVED FOR PRODUCTION** subject to:

1. **All mandatory constraints implemented** (Sections 18, 19, 21)
2. **Staged rollout followed** for agent mode (Appendix C)
3. **All v1.1 requirements satisfied** (audit, legal, testing per Section 4.3)
4. **Agent API security audit completed** before mainnet agent activation

**Protocol Integrity:** ✅ PRESERVED

All v1.1 normative sections remain unchanged. No protocol invariants weakened. No trust assumptions added beyond explicit operational dependencies.

**Positioning Achieved:** ✅ SUCCESS

MidlLaunch is now specified as the canonical issuance layer on Bitcoin, supporting:
- Human creators (Manual mode)
- AI-assisted creators (AI-Assisted mode)
- Autonomous agents (Agent-Driven mode)

All while maintaining a **single canonical protocol core** with uniform settlement, pricing, and trust assumptions.

**This specification will remain correct, safe, auditable, and maintainable even if 90% of launches are done by AI agents in the future.**

---

## Document Version Control

**Version 1.3** - February 9, 2026

**MAJOR EXTENSIONS:**
- Added Section 18: Execution Modes (NORMATIVE)
- Added Section 19: AI & Agent Constraints (NORMATIVE)
- Added Section 20: Execution Mode Failure & Abuse Analysis (NORMATIVE)
- Added Section 21: Spam & Sybil Resistance (NORMATIVE)
- Updated Section 22: PRD Lock-In Summary (v1.3)
- Added Appendix B: Implementation Guidance (Non-Normative)
- Added Appendix C: Agent Rollout Strategy (Non-Normative)
- Added Appendix D: Regression Verdict (NORMATIVE)
- Extended event schemas with executionMode tracking (non-breaking)

**ALL v1.1 NORMATIVE SECTIONS REMAIN UNCHANGED:**
- Section 9: Settlement Model
- Section 7B: Canonical Unit Conventions
- Section 8: Bonding Curve Design
- Appendix A: Closed-Form Curve Solution
- All other v1.1 sections (1-17)

**Review required before mainnet (extended from v1.1):**
- All v1.1 requirements (audit, settlement validation, legal, testing)
- Agent API security audit (parameter validation, rate limiting, authentication)
- Agent spam resistance testing (Sybil attacks, rate limit evasion)
- AI service integration testing (suggest/review/approve flows)
- Metadata scanning for social engineering attacks
- Staged rollout execution per Appendix C

**Signed:** Senior Protocol PM, Systems Architect, Adversarial Reviewer  
**Date:** February 9, 2026

---

**END OF DOCUMENT v1.3**
