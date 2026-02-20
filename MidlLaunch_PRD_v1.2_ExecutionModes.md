# MidlLaunch PRD v1.2 — Execution Modes Extension

## Executive Addendum: Multiple Execution Modes, Single Protocol Core

**Purpose:** This addendum extends MidlLaunch PRD v1.1 to support multiple launch **execution modes** without altering protocol invariants, settlement semantics, or trust boundaries.

### What Changes (Execution Layer Only)

MidlLaunch v1.2 introduces three distinct paths for **initiating** a token launch:

1. **Manual Launch**: User directly inputs parameters and signs Bitcoin transactions (baseline reference path)
2. **AI-Assisted Launch**: User interacts with an AI interface that suggests parameters, generates metadata, and provides disclosures (AI output is advisory; user retains full control)
3. **Agent-Driven Launch**: External autonomous agents (bots, AI services, programmatic systems) initiate launches via authenticated API endpoints (subject to rate limits and authorization)

### What Does NOT Change (Protocol Invariants)

**All normative specifications from v1.1 remain unchanged:**

- **Settlement Model (Section 9)**: All execution modes produce identical on-chain transactions. FBT → Intent → Execution → RBT semantics apply uniformly. No execution mode bypasses validator settlement.
  
- **Canonical Unit Conventions (Section 7B)**: All modes use identical pricing (sats per whole token), identical accounting (totalBTCDepositedSats), identical slippage protection (minTokensOut in base units).

- **Bonding Curve Math (Section 8, Appendix A)**: All modes invoke the same closed-form linear curve. AI cannot create custom curves. Agents cannot manipulate pricing logic.

- **Trust Boundaries (Section 5)**: All modes rely on trust-minimized validator/TSS custody. No execution mode gains trustless custody. AI does not hold keys. Agents do not control vaults.

- **Buy-Side Only Scope**: No execution mode introduces sell logic, AMM migration, or fairness guarantees. These remain explicitly rejected (Section 3).

- **Event Schemas (Section 13)**: All launches emit identical canonical events with intentId correlation, regardless of execution mode.

### Why This Is Safe (Invariant-Preserving)

**Execution modes are UI/API variations, not protocol extensions.**

The protocol enforces:
- LaunchFactory.createLaunch() accepts parameters and deploys contracts
- BondingCurvePrimaryMarket.buy() accepts BTC and mints tokens
- Parameters must satisfy Section 8 bounds

The protocol does NOT enforce:
- How parameters were chosen (human judgment, AI suggestion, agent algorithm)
- Who initiated the transaction (human, AI-advised human, agent with delegated authority)

**Analogy:** Ethereum does not distinguish between transactions signed via MetaMask UI, programmatic web3.js calls, or autonomous smart contract wallets. The EVM executes valid transactions regardless of origin.

**Critical constraint:** All modes require valid Bitcoin transaction signatures. No mode bypasses user custody or introduces implicit authority.

### Positioning Statement

By supporting multiple execution modes, MidlLaunch becomes **the definitive source for token launches on Bitcoin** across human, AI-assisted, and autonomous agent economies—without fragmenting protocol correctness or trust assumptions.

---

## New Section 18: Execution Modes (Normative)

> **Purpose:** Define authorized paths for initiating token launches. All modes produce protocol-compliant launches; differences are in parameter generation and initiation flow.

### 18.1 Mode Classification

MidlLaunch recognizes three execution modes:

| Mode | Initiator | Parameter Source | Authorization | Use Case |
|------|-----------|------------------|---------------|----------|
| Manual | Human user | User input via UI form | User signs Bitcoin tx | Standard launches, creator-driven tokens |
| AI-Assisted | Human user | AI-suggested parameters + user approval | User signs Bitcoin tx | Streamlined UX, metadata generation, compliance templates |
| Agent-Driven | External agent | Agent algorithm | Agent-controlled key OR user delegation | Autonomous economies, programmatic launches, agent DAOs |

**Normative requirement:** All modes MUST result in a valid Bitcoin transaction signed by a key authorized to spend the required BTC and trigger the launch.

### 18.2 Manual Launch (Reference Path)

**Initiation flow:**
1. User navigates to frontend
2. User inputs launch parameters manually:
   - Token name, symbol
   - Supply cap
   - Curve parameters (basePrice, priceIncrement) within bounds (Section 8)
   - Creator fee rate (optional, within bounds)
   - Metadata (optional)
3. Frontend validates parameters against protocol bounds
4. User reviews parameter summary and estimated BTC cost
5. User signs Bitcoin transaction via wallet (Xverse, Unisat)
6. Standard flow per Section 10 (Flow 1: Launch Creation)

**Authorization:**
- User's Bitcoin wallet signature is sole authority
- No intermediaries, no AI in critical path

**Trust boundaries:**
- Frontend displays parameters correctly (trusted operational, per Section 5)
- User verifies parameters before signing (user responsibility)
- Settlement per Section 9

**Explicit non-guarantees:**
- Frontend cannot prevent user from choosing bad parameters within protocol bounds
- Protocol does not validate "reasonableness" of parameters, only bound compliance

### 18.3 AI-Assisted Launch

**Initiation flow:**
1. User selects "AI-Assisted Launch" mode
2. User interacts with AI interface (chat, wizard, or form with AI suggestions):
   - Describes intent (e.g., "meme token for my cat project")
   - AI suggests: name, symbol, supply, curve parameters, metadata
   - AI generates: description text, risk disclosures, parameter explanations
3. Frontend displays AI-generated suggestions clearly marked as "AI-suggested" (not authoritative)
4. **USER MUST REVIEW AND APPROVE** each parameter
5. User can edit any AI-suggested value
6. User proceeds to sign Bitcoin transaction (identical to Manual mode from this point)

**What AI can do (advisory only):**
- Suggest parameter values based on user input
- Generate metadata text (descriptions, marketing copy)
- Suggest risk disclosures or compliance templates
- Check parameter validity against protocol bounds pre-submission
- Provide explanations of curve behavior

**What AI CANNOT do (hard constraints):**
- Sign Bitcoin transactions on user's behalf
- Bypass user review/approval step
- Set parameters that violate protocol bounds (frontend enforces Section 8 constraints)
- Access user's private keys
- Claim outputs are "guaranteed safe" or "audited"

**Authorization:**
- Same as Manual: user's Bitcoin wallet signature
- AI output has ZERO protocol authority
- User signature = acceptance of responsibility for AI-suggested parameters

**Trust boundaries:**
- AI service is **explicitly trusted operational** (per Section 5 classification)
- AI could suggest malicious or suboptimal parameters
- Frontend MUST display AI-suggested values with clear "Review AI Output" warnings
- Users MUST verify parameters independently (e.g., via calculator, third-party tools)

**Explicit non-guarantees:**
- Protocol does not validate AI output correctness
- AI hallucinations or malicious suggestions are user's risk
- No recourse if AI-suggested parameters result in unfavorable launches

**Abuse vectors and mitigations:**

| Attack | Severity | Mitigation |
|--------|----------|------------|
| AI suggests malicious params (e.g., basePrice=1, priceIncrement=1 to enable cheap rug) | Critical | Frontend enforces minimum "quality" bounds beyond protocol minimums (e.g., basePrice >= 10k sats) + prominent warning |
| AI generates fake social links in metadata | High | Metadata is not protocol-validated; frontend shows "unverified" label |
| AI spam-generates low-effort launches | Acceptable | Standard launch creation fee applies; spam is economic, not protocol, concern |

### 18.4 Agent-Driven Launch

**Initiation flow:**
1. External agent (bot, AI service, autonomous system) authenticates to MidlLaunch API
2. Agent submits launch request via API endpoint:
   ```
   POST /api/v1/agent-launch
   Headers: Authorization: Bearer <agent_api_key>
   Body: {
     agentId: "agent-xyz",
     tokenName: "AgentToken",
     tokenSymbol: "AGT",
     supplyCap: 1000000,
     basePrice: 50000,
     priceIncrement: 100,
     creatorFeeRate: 100,
     metadata: { ... },
     signature: <agent_signature_or_user_delegation_proof>
   }
   ```
3. API validates:
   - Agent is authenticated and within rate limits
   - Parameters satisfy protocol bounds
   - Signature proves custody or delegation
4. API constructs Bitcoin transaction (or agent provides pre-signed tx)
5. Standard flow per Section 10

**Authorization models (agent MUST use one):**

**Model A: Agent-Controlled Wallet**
- Agent operates with its own Bitcoin wallet (private key managed by agent infrastructure)
- Agent signs Bitcoin transactions directly
- Agent bears BTC cost of launches
- Use case: Autonomous agent economies where agents "own" tokens

**Model B: User Delegation**
- User pre-authorizes agent to launch on their behalf (e.g., via signed delegation message)
- Agent proves delegation but user's wallet still signs the final Bitcoin tx (via API callback)
- User bears BTC cost
- Use case: User deploys agent as their "launch assistant" but retains custody

**Normative requirement:** Agent-driven launches MUST NOT bypass Bitcoin transaction signature requirements. If agent uses Model A, agent controls its own keys (trust assumption). If Model B, user retains custody.

**Trust boundaries:**
- **Agent is explicitly untrusted** from protocol perspective
- Agent could be malicious, buggy, or compromised
- Protocol enforces same parameter bounds as Manual/AI-Assisted modes
- No additional trust in agent correctness

**Explicit non-guarantees:**
- Protocol does not validate agent intent or "good faith"
- Agent-launched tokens have no special status or guarantees
- Users interacting with agent-launched tokens bear full risk

**Abuse vectors and mitigations:**

| Attack | Severity | Mitigation | Status |
|--------|----------|------------|--------|
| Agent spam-launches thousands of worthless tokens | Existential (pollutes ecosystem) | **Mandatory:** Agent-specific rate limits (e.g., 10 launches/day/agent) + launch fee escalation + staking requirement | MUST IMPLEMENT |
| Malicious agent sets pathological params to grief users | Critical | Same protocol bounds as Manual; frontend can flag agent-launched tokens with "caution" badge | Acceptable risk |
| Agent social-engineers users via metadata | High | Frontend labels agent launches clearly; no "verified" status without curation | Acceptable risk |
| Agent bypasses rate limits via Sybil (multiple API keys) | High | Require staking deposit per agent registration; PoW challenges; allowlist during beta | MUST IMPLEMENT |
| Agent exploits API bugs to bypass param validation | Critical | Extensive API testing; parameters re-validated on-chain in LaunchFactory | MUST IMPLEMENT |

**Required constraints for production:**

1. **Agent Registration:** Agents must register and stake BTC (e.g., 0.01 BTC) to obtain API keys. Stake slashed if agent violates rate limits or terms.

2. **Rate Limits (Normative):**
   - Per agent: Max 10 launches per 24 hours (environment-configurable)
   - Global agent launches: Max 1000 per day (to prevent ecosystem spam)
   - Adjustable via governance in future versions

3. **Agent Wallet Disclosure:**
   - If Model A (agent-controlled wallet), agent's Bitcoin address must be public and linked to agent identity
   - Frontend shows "Launched by Agent: [agentId] ([btc_address])"

4. **No Autonomous Custody Claims:**
   - Agents using Model A do NOT gain protocol-level "trustless" status
   - Agent wallet custody is agent's operational security, not protocol guarantee

---

## New Section 19: AI & Agent Constraints (Normative)

> **Purpose:** Define hard boundaries for AI and agent behavior to prevent protocol exploitation or trust confusion.

### 19.1 AI Service Constraints

**What AI services MAY do:**
- Analyze user input and suggest launch parameters
- Generate metadata text, images, or documentation
- Provide educational content about curve behavior
- Validate parameters against protocol bounds pre-submission
- Estimate BTC costs and expected token outputs

**What AI services MUST NOT do:**
- Sign Bitcoin transactions on behalf of users
- Access or store user private keys
- Claim authority over parameter correctness ("AI-audited")
- Bypass user review/approval flows
- Execute launches without explicit user confirmation
- Guarantee token performance or safety

**Frontend Requirements (Normative):**

When displaying AI-suggested parameters, frontend MUST:
- Label all AI output as "AI-Suggested (Not Audited)"
- Require explicit user confirmation: "I have reviewed AI suggestions and accept responsibility"
- Display parameter bounds and constraints clearly
- Provide "Edit" functionality for every AI-suggested field
- Show risk warnings if AI suggests values near protocol minimums

**AI Service Trust Classification:**
- AI services are **explicitly trusted operational dependencies** (per Section 5)
- AI failures or malicious output are outside protocol's security model
- Users assume risk of relying on AI suggestions

### 19.2 Agent Behavior Constraints

**What agents MAY do:**
- Initiate launches via authenticated API
- Operate with agent-controlled wallets (Model A)
- Act under user delegation (Model B)
- Set parameters within protocol bounds
- Interact with launched tokens post-creation

**What agents MUST NOT do:**
- Bypass parameter validation or bounds
- Claim implicit authority from protocol
- Exceed rate limits
- Impersonate other agents or users
- Execute transactions without valid signatures

**Agent Classification:**
- Agents are **explicitly untrusted actors** from protocol perspective
- Agents may be benevolent, neutral, or malicious
- Protocol treats all agent launches identically to manual launches (same bounds, same settlement)

**Agent Accountability (Operational):**
- Agent API keys are revocable by admin (Section 14 powers)
- Agents violating rate limits or terms face:
  - API key suspension
  - Stake slashing (if staking implemented)
  - Removal from any frontend listings

### 19.3 Metadata and Social Engineering Prevention

**Problem:** AI and agents can generate misleading metadata (fake team info, false claims, impersonation).

**Protocol stance:** Metadata is NOT protocol-validated or consensus-enforced (per Section 5).

**Mitigations (Operational, enforced in UI/API layer):**

1. **Metadata Disclaimer:** All launches display: "Metadata is user/AI/agent-provided and unverified."

2. **Agent Launch Badges:** Frontend labels agent-launched tokens:
   - "🤖 Agent-Launched by [agentId]"
   - "⚠️ Autonomous Launch — Verify Claims Independently"

3. **AI-Assisted Launch Badges:** Frontend labels AI-assisted launches:
   - "✨ AI-Assisted Launch — User-Confirmed Parameters"

4. **Curation Layer (Optional, Non-Protocol):**
   - Frontend may offer "verified" or "reviewed" badges via manual review
   - This is UI-layer curation, NOT protocol enforcement
   - Explicitly disclosed as centralized trust

### 19.4 Prohibited Agent Behaviors (Enforced via API/Frontend)

The following behaviors are prohibited and will result in agent suspension:

1. **Impersonation:** Agent claims to represent a project/person without authorization
2. **Spam:** Agent exceeds rate limits or creates obvious junk launches
3. **Parameter Exploitation:** Agent attempts to bypass bounds via API manipulation
4. **Social Engineering:** Agent uses metadata to phish or scam (if reported and verified)

**Enforcement:** Operational (admin/governance powers per Section 14), NOT on-chain.

---

## New Section 20: Expanded Failure & Abuse Analysis

> **Purpose:** Extend Section 11 failure modes to cover AI and agent-specific risks.

### 20.1 AI-Specific Failure Modes

**1. AI Parameter Hallucination**
- **Scenario:** AI suggests invalid or nonsensical parameters (e.g., negative supply, non-numeric values)
- **Severity:** Acceptable (frontend validation catches before submission)
- **Mitigation:** Frontend re-validates all parameters against protocol bounds; AI output is treated as untrusted input

**2. AI Suggests Pathological Curves**
- **Scenario:** AI recommends basePrice=1000, priceIncrement=1 (enables cheap acquisition of entire supply)
- **Severity:** High (enables economic griefing)
- **Mitigation:** 
  - Frontend enforces "quality minimums" above protocol bounds (e.g., basePrice >= 50k sats for mainnet)
  - Display prominent warning: "Low pricing parameters detected — high rug risk"
  - User must acknowledge risk explicitly

**3. AI Generates Malicious Metadata**
- **Scenario:** AI creates description with phishing links or impersonates known project
- **Severity:** Critical (reputational damage to ecosystem)
- **Mitigation:**
  - Frontend scans metadata for known scam patterns (e.g., "send BTC to" phrases)
  - All metadata labeled as unverified
  - Community reporting mechanism for flagging malicious launches

**4. AI Service Downtime**
- **Scenario:** AI API becomes unavailable during launch flow
- **Severity:** Acceptable (UX failure, not protocol failure)
- **Mitigation:** Frontend gracefully degrades to Manual mode; AI-assisted mode is optional enhancement

### 20.2 Agent-Specific Failure Modes

**1. Agent Spam Attack**
- **Scenario:** Malicious agent deploys 10,000 worthless tokens to pollute launch registry
- **Severity:** Existential (damages ecosystem discoverability and trust)
- **Mitigation:** **MANDATORY for production:**
  - Per-agent rate limit: 10 launches/24hr
  - Global agent rate limit: 1000 launches/day
  - Staking requirement: 0.01 BTC deposit per agent registration
  - Launch fee escalation: Nth launch from agent costs base_fee × N
  - Admin can revoke agent API keys (Section 14)

**2. Sybil Agent Attack**
- **Scenario:** Attacker creates 100 agent identities to bypass rate limits
- **Severity:** Critical (rate limits become ineffective)
- **Mitigation:**
  - Require PoW challenge for agent registration (e.g., hashcash)
  - Staking requirement per agent (increases Sybil cost)
  - Allowlist approach during initial rollout (mainnet launch)
  - CAPTCHA or proof-of-humanity for agent operators

**3. Agent Wallet Compromise**
- **Scenario:** Agent's private key is stolen; attacker launches malicious tokens under agent's identity
- **Severity:** High (reputational damage to agent, users may be scammed)
- **Mitigation:**
  - Agent wallet compromise is agent's operational risk, NOT protocol risk
  - Frontend warns users: "Agent-launched tokens carry agent custody risk"
  - Agents should use key rotation and multi-sig patterns (best practice, not enforced)

**4. Agent Exploits API Logic**
- **Scenario:** Agent discovers bug in API parameter validation; bypasses protocol bounds
- **Severity:** Existential (breaks protocol invariants)
- **Mitigation:** **MANDATORY:**
  - Double validation: API validates parameters AND on-chain factory re-validates
  - LaunchFactory.createLaunch() enforces bounds regardless of caller
  - Extensive fuzzing and security testing of API before mainnet
  - Bug bounty program for API vulnerabilities

**5. Malicious Agent Metadata**
- **Scenario:** Agent creates launch with metadata claiming to be "official Bitcoin Foundation token"
- **Severity:** Critical (social engineering attack)
- **Mitigation:**
  - Same as AI metadata attacks (Section 20.1.3)
  - Prominent "Agent-Launched" badge
  - No "verified" status without manual review
  - Community flagging system

**6. Agent Denial-of-Service**
- **Scenario:** Agent sends malformed requests to API at high rate
- **Severity:** Acceptable (operational issue, not protocol)
- **Mitigation:**
  - Standard API rate limiting and DDoS protection
  - Agent suspension for repeated violations

### 20.3 Cross-Mode Attack Vectors

**1. Mode Confusion Attack**
- **Scenario:** Attacker launches token via Agent mode, then claims on social media it was "AI-audited" (misleading)
- **Severity:** High (social engineering)
- **Mitigation:**
  - All launches record execution mode in events (new field: `executionMode` enum)
  - Frontend displays mode clearly on token pages
  - Educate users that modes do NOT imply safety guarantees

**2. Parameter Boundary Gaming**
- **Scenario:** User/AI/Agent chooses parameters at protocol minimums to game system
- **Severity:** Acceptable (within protocol rules)
- **Mitigation:**
  - Not a protocol failure; parameters within bounds are allowed
  - Frontend can display risk scores based on parameters
  - Curation layer can filter low-quality launches

---

## Updated Section 17: PRD Lock-In Summary (v1.2)

This section extends Section 17 from v1.1 to reflect execution mode additions.

### Additional Locked Decisions (v1.2)

**6. Execution Mode Architecture**
   - Three modes supported: Manual, AI-Assisted, Agent-Driven
   - All modes produce identical on-chain behavior
   - No mode bypasses settlement semantics (Section 9)
   - No mode gains privileged protocol status

**7. AI and Agent Trust Classification**
   - AI services are trusted operational dependencies (user risk)
   - Agents are explicitly untrusted actors (same bounds as manual)
   - No mode introduces new custody models beyond validator/TSS (Section 9)

### What STILL Cannot Change Without Breaking Protocol

All items from v1.1 remain, plus:

**8. Execution Mode Invariants:**
   - All launches must produce valid FBT → Intent → Execution flow (Section 9)
   - All launches must satisfy parameter bounds (Section 8)
   - No mode can bypass user/agent signature requirements
   - Event schemas remain uniform across modes (Section 13, with executionMode added)

### What Can Change in Minor Updates (Extended)

In addition to v1.1 items:

**5. AI/Agent Constraints:**
   - Rate limits can be adjusted (within documented ranges)
   - Agent registration requirements can be updated (e.g., staking amounts)
   - AI service providers can be changed
   - Metadata scanning rules can be improved

**6. Frontend Mode Selection:**
   - UX for switching between modes
   - AI interface design (chat vs wizard)
   - Agent API endpoint structure (versioned)

---

## Appendix B: Execution Mode Implementation Guidance (Non-Normative)

> **Purpose:** Provide implementation notes for developers. This appendix is advisory and non-binding.

### B.1 Frontend Architecture Recommendation

```
User Interface Layer
├── Manual Launch Form (baseline)
├── AI Chat Interface (optional)
│   └── AI Backend API (external service)
└── Agent API Client (for testing)

Parameter Validation Layer (enforces Section 8 bounds)

Transaction Construction Layer (shared by all modes)
├── Uses midl-js SDK
└── Produces FBT + Intent

Settlement Layer (Section 9)
```

**Key principle:** All modes converge to the same transaction construction layer. Only parameter sourcing differs.

### B.2 AI-Assisted Mode: Recommended Flow

```typescript
// Pseudocode
async function aiAssistedLaunch(userInput: string) {
  // 1. User input
  const description = userInput; // e.g., "Launch meme token for my cat"
  
  // 2. AI generates suggestions
  const aiSuggestions = await callAIAPI({
    prompt: `Suggest token launch params for: ${description}`,
    constraints: PROTOCOL_BOUNDS, // Section 8 bounds
  });
  
  // 3. Display AI output with warnings
  displaySuggestions(aiSuggestions, warnings: [
    "AI-suggested parameters are not audited",
    "Review all values before signing transaction"
  ]);
  
  // 4. User review and edit
  const userApprovedParams = await getUserApproval(aiSuggestions);
  
  // 5. Validate against protocol bounds (defense in depth)
  validateParams(userApprovedParams); // throws if invalid
  
  // 6. Proceed to standard launch flow
  return manualLaunch(userApprovedParams);
}
```

### B.3 Agent API: Recommended Endpoint Design

```
POST /api/v1/agent/launch
Authorization: Bearer <agent_api_key>

Request Body:
{
  "agentId": "string",
  "authModel": "AGENT_WALLET" | "USER_DELEGATION",
  "tokenName": "string",
  "tokenSymbol": "string",
  "supplyCap": number,
  "basePrice": number,
  "priceIncrement": number,
  "creatorFeeRate": number,
  "metadata": object,
  "signature": "string" // Agent sig or user delegation proof
}

Response (Success):
{
  "launchId": "uuid",
  "fbtTxid": "string",
  "midlTxHash": "string",
  "tokenAddress": "0x...",
  "status": "PENDING" | "CONFIRMED"
}

Response (Rate Limited):
{
  "error": "RATE_LIMIT_EXCEEDED",
  "retryAfter": seconds,
  "dailyQuota": 10,
  "used": 10
}
```

### B.4 Event Schema Extension

Extend Section 13 events with execution mode tracking:

```solidity
enum ExecutionMode {
    MANUAL,
    AI_ASSISTED,
    AGENT_DRIVEN
}

event LaunchCreated(
    address indexed tokenAddress,
    address indexed curveAddress,
    address indexed creator,
    bytes32 intentId,
    uint256 supplyCap,
    uint256[] curveParams,
    ExecutionMode mode,  // NEW in v1.2
    bytes32 modeMetadata // NEW: hash of AI model ID or agent ID
);
```

**Rationale:** Allows on-chain tracking of execution mode without implying different trust levels.

---

## Appendix C: Roadmap (Non-Binding, Inspiration Only)

> **CRITICAL:** This appendix is explicitly non-binding. It does NOT create dependencies for v1.2 correctness. It is marketing/vision material ONLY.

### Phase 1: Manual + AI-Assisted (Current Scope)
- Launch with human-driven and AI-assisted modes
- Build trust through transparency and user education
- Validate AI output quality with real usage

### Phase 2: Controlled Agent Rollout
- Beta agent API with allowlist
- Staking requirement enforced
- Monitor spam and abuse patterns
- Adjust rate limits based on empirical data

### Phase 3: Agent Economy Integration
- Open agent registration (post-beta)
- Agent reputation system (off-chain scores based on launch quality)
- Agent-to-agent token interactions (e.g., agents trading launched tokens)
- Agent DAO governance participation (future governance system)

### Phase 4: Advanced AI Features (Speculative)
- AI-powered risk scoring for launches (show users "AI safety score")
- Automated compliance template generation (KYC/AML stubs for regulated launches)
- Cross-chain metadata bridging (if Midl adds cross-chain support)

### Phase 5: Institutional Agent Support (Long-Term)
- Enterprise agent API tier with SLAs
- Compliance-ready agent launches (regulated tokens)
- Agent-managed treasury integrations

**Reminder:** None of these phases are required for v1.2. Each must pass full PRD-level analysis before adoption.

---

## Appendix D: Viability Regression Test Results

> **Purpose:** Document the adversarial review of each execution mode against protocol constraints.

### D.1 Manual Launch Mode

**Technical Feasibility:** 10/10 (already specified in v1.1)
**Economic Attack Surface:** Low (user bears all risks; protocol bounds prevent worst cases)
**Abuse Vectors:** Minimal (users can create bad launches within bounds; acceptable)
**UX Failure Modes:** Low (standard wallet signing flow)
**Operational Dependencies:** Wallet compatibility only

**Verdict:** APPROVED. Baseline reference path.

### D.2 AI-Assisted Launch Mode

**Technical Feasibility:** 9/10 (requires AI API integration; standard REST calls)

**Economic Attack Surface:** Medium
- AI could suggest unfavorable parameters
- Mitigation: User review mandatory, frontend enforces quality minimums

**Abuse Vectors:** Medium
- AI spam-generates low-effort launches → Mitigated by launch fees (same as manual)
- AI malicious metadata → Mitigated by unverified labels, community flagging

**UX Failure Modes:** Medium
- AI hallucinations confuse users → Mitigated by clear labeling, edit functionality
- AI service downtime → Mitigated by fallback to manual mode

**Operational Dependencies:** External AI API (trusted operational)

**Constraints Required:**
- MUST label AI output as unverified
- MUST require user confirmation
- MUST allow editing all AI-suggested fields
- MUST validate parameters independent of AI

**Verdict:** APPROVED with mandatory constraints implemented.

### D.3 Agent-Driven Launch Mode

**Technical Feasibility:** 8/10 (requires API development, authentication, rate limiting)

**Economic Attack Surface:** High (without constraints), Medium (with mitigations)
- Agent spam attack → MUST implement rate limits + staking
- Sybil attack → MUST implement PoW or allowlist initially
- Parameter exploitation → MUST double-validate (API + on-chain)

**Abuse Vectors:** High
- Spam launches → Rate limits + launch fee escalation
- Malicious metadata → Explicit labeling + community flagging
- API exploitation → Extensive testing + bug bounty

**UX Failure Modes:** Medium
- Agent wallet compromise → Operational risk (not protocol)
- Agent bugs → Same as user errors (bounded by protocol)

**Operational Dependencies:** 
- API infrastructure (rate limiting, authentication)
- Staking system (for Sybil resistance)
- Monitoring and abuse detection

**Constraints Required (MANDATORY):**
- MUST implement per-agent rate limits (10 launches/24hr)
- MUST implement global agent rate limits (1000 launches/day)
- MUST require agent registration with staking (0.01 BTC minimum)
- MUST double-validate parameters (API + on-chain)
- MUST label agent launches explicitly in UI
- MUST provide agent suspension mechanism

**Verdict:** APPROVED with MANDATORY constraints. Agent mode should launch in controlled beta with allowlist before public rollout.

### D.4 Cross-Mode Analysis

**Settlement Model Compliance:** PASS
- All modes use identical FBT → Intent → Execution flow
- No mode bypasses Section 9 semantics

**Unit Convention Compliance:** PASS
- All modes use identical pricing (sats per whole token)
- No mode introduces new accounting

**Trust Boundary Compliance:** PASS
- No mode weakens trust disclosures
- AI and agents explicitly classified as untrusted/operational

**Scope Compliance:** PASS
- No mode introduces sell logic, AMM, or fairness guarantees
- All modes remain buy-side only

**Event Schema Compliance:** PASS (with extension)
- ExecutionMode enum added to events (non-breaking)
- Existing fields unchanged

---

## Document Version Control (Updated)

**Version 1.2** - February 8, 2026
- **MAJOR EXTENSION**: Added Section 18 (Execution Modes)
- **MAJOR EXTENSION**: Added Section 19 (AI & Agent Constraints)
- **MAJOR EXTENSION**: Added Section 20 (Expanded Failure & Abuse Analysis)
- Added Appendix B (Implementation Guidance)
- Added Appendix C (Non-Binding Roadmap)
- Added Appendix D (Viability Regression Test Results)
- Updated Section 17 (PRD Lock-In Summary)
- Extended event schemas with executionMode tracking

**All v1.1 normative sections remain unchanged:**
- Section 9 (Settlement Model)
- Section 7B (Canonical Unit Conventions)
- Section 8 (Bonding Curve Design)
- Appendix A (Closed-Form Curve Solution)
- All other v1.1 sections

**Review required before mainnet (extended from v1.1):**
- AI service integration testing (suggest/review/approve flows)
- Agent API security audit (parameter validation, rate limiting, authentication)
- Agent spam resistance testing (Sybil attacks, rate limit evasion)
- Metadata scanning for social engineering attacks
- All v1.1 requirements (settlement validation, curve math audit, wallet compatibility, etc.)

---

**END OF V1.2 EXTENSION**
