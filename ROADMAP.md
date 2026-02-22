# MidlLaunch
**Bitcoin-Native Capital Infrastructure for Human and Autonomous Participants**

**Version:** 1.0  
**Status:** Public Infrastructure + Structured Expansion Roadmap  
**Network:** Midl (Bitcoin L2)  
**Date:** 2026

## 1. Executive Summary

MidlLaunch is a Bitcoin-native capital formation protocol built on Midl.

It is not a simple token launcher. It is an infrastructure layer for:
- Token issuance
- Structured capital raising
- NFT-based participation mechanics
- Liquidity engineering
- Real-time indexed market data
- Agent-executable capital flows

The protocol combines bonding curve issuance, transparent onchain event indexing, and machine-readable APIs to support both human users and autonomous agents.

The long-term vision is to make MidlLaunch a programmable capital rail for Bitcoin L2 ecosystems.

## 2. Problem Statement

Bitcoin L2 ecosystems lack:
- Structured capital formation tools
- Transparent bonding curve-based issuance
- Agent-readable launch data
- Built-in treasury controls
- Post-launch liquidity and analytics tooling

Most launchpads operate as UI-driven vending machines: `Launch → List → Dump → Abandon.`

They lack:
- Founder accountability
- Structured treasury release
- Agent integration
- Liquidity engineering
- Machine-readable risk scoring

MidlLaunch is designed to solve these structural gaps.

## 3. System Architecture

MidlLaunch is built as a layered infrastructure system:

`Smart Contracts (Midl) ↓ Onchain Events ↓ Event Indexer ↓ Database (Indexed State) ↓ REST API + WebSocket Layer ↓ Frontend + External Agents`

### Core Components
#### 3.1 Smart Contracts
- LaunchFactory
- Bonding Curve Primary Market
- Purchase and supply tracking logic

#### 3.2 Event Indexer
- Listens to blockchain events
- Processes launch creation
- Tracks purchases
- Updates supply state
- Aggregates statistics

#### 3.3 Backend Infrastructure
- REST API endpoints
- WebSocket server for real-time updates
- Prisma schema
- Redis pub/sub for event broadcasting

#### 3.4 Frontend
- Next.js 14
- Production build
- Dark + light mode
- Bitcoin-native design language
- Full lifecycle transaction display

#### 3.5 Agent Interface Layer
Machine-readable API endpoints for:
- Launch discovery
- Metrics retrieval
- Risk evaluation
- Execution simulation
- Position monitoring

## 4. Current System Status

- **Backend infrastructure:** implemented
- **Frontend interface:** implemented
- **Indexer:** implemented (RPC reliability issues)
- **SDK integration:** blocked (pending Midl SDK availability)

**Critical blockers currently include:**
- RPC SSL instability preventing reliable event indexing
- Absence of official Midl SDK for transaction construction

The system architecture is complete, but full end-to-end launch and buy flows require SDK and RPC stabilization.
*No false claims are made about live transaction throughput.*

## 5. Core Product Design

### 5.1 Launch Engine
Each launch defines:
- Token name
- Symbol
- Supply cap
- Base price (sats per token)
- Linear price increment
- Creator fee rate

Pricing follows a deterministic bonding curve:
`Price(n) = basePrice + (priceIncrement × currentSupply)`

This provides:
- Transparent pricing
- Predictable issuance
- No arbitrary price discovery
- Continuous liquidity

### 5.2 Launch Types (Roadmap Expansion)
The platform expands beyond basic IDO into multiple issuance models:

1. **IDO (Initial DEX Offering)**: Classic bonding curve token issuance.
2. **Auction-Based Launch**: Batch auction or Dutch auction pricing. Improves price discovery and reduces early manipulation.
3. **NFT Launch Pools**: NFT-based participation with utility mechanics.
4. **Hybrid Token + NFT Launch**: Allocation NFTs granting structured access or revenue share.

## 6. Creator Ecosystem
**Creator Profiles (Planned Expansion)**

Each creator will have:
- Wallet-linked identity
- Launch history
- Total raised
- Graduation rate
- Onchain performance metrics

Long-term roadmap includes:
- Reputation scoring
- Milestone NFTs
- Historical success tracking
- Fee tier adjustments based on reputation

This introduces longitudinal accountability.

## 7. NFT Capital Layer (Strategic Expansion)

NFTs are not treated as collectibles, but as structured capital primitives.

Planned implementations:
- **7.1 Allocation NFTs**: Presale rights encoded onchain.
- **7.2 Milestone NFTs**: Roadmap achievement markers tied to treasury release.
- **7.3 Revenue Share NFTs**: Protocol revenue distribution encoded via NFT ownership.
- **7.4 Dynamic Participation NFTs**: Metadata evolves based on Holding duration, Governance participation, and Onchain behavior.

This transforms NFTs into programmable participation layers.

## 8. Trading & Liquidity Suite (Expansion)
- **8.1 Native Trading Interface**: Real-time price chart, Transaction history, Liquidity metrics, Slippage estimation
- **8.2 DEX Routing Layer**: Long-term Multi-pool routing, Cross-L2 liquidity
- **8.3 Advanced Analytics**: Liquidity depth, Volume heatmaps, Momentum scoring, Unlock schedule modeling

## 9. Staking & Yield Infrastructure (Expansion)
- **9.1 Native Token Staking**: Boost launch allocation, Earn yield, Governance participation
- **9.2 Dynamic Yield Pools**: Rewards based on Lock duration, Participation level
- **9.3 Revenue Distribution Pools**: Launch fees routed into staking pools.

## 10. Governance Framework

Planned governance features:
- Launch curation voting
- Fee parameter voting
- Feature activation proposals
- Reputation-weighted governance

*Governance endpoints will be machine-readable for agent participation.*

## 11. Agent-Native Architecture

MidlLaunch is designed to be agent-readable from inception.

- **11.1 Agent Discovery Layer**: Agents can query Active launches, Trending launches, Near-graduation launches, Filtered launch sets
- **11.2 Evaluation Layer**: Structured metrics exposed via API (Raise velocity, Liquidity depth, Volatility score, Risk flags, Founder score, Unlock schedule JSON). Agents consume numerical signals, not marketing text.
- **11.3 Execution Layer**: Endpoints (Simulate purchase, Execute purchase, Lock position, Sell position, Claim rewards)
- **11.4 Portfolio Layer**: Agents can monitor Wallet positions, Performance metrics, Exposure concentration, Risk distribution

## 12. X402 Integration Strategy

X402 will serve as:
- API monetization layer
- Agent gating system
- Micropayment-based access control

**Current State**: Endpoints are publicly accessible.
**Future Flow**: Premium endpoints will return `HTTP 402 Payment Required`. Agent performs micropayment → Access is unlocked.

Planned premium endpoints:
- Advanced analytics
- Whale tracking
- Smart money signals
- Tokenomics simulation

The system is structured to allow minimal refactoring once X402 is available on Midl.

## 13. Economic Model (High-Level)

**Revenue streams:**
- Launch creation fees
- Creator fee percentage
- Trading fees
- Premium API (X402)
- Staking incentives

**Long-term:**
- Agent strategy marketplace fees
- Cross-L2 liquidity routing fees

## 14. Roadmap

**Phase 1 – Core Infrastructure (In Progress)**
- Bonding curve launch engine
- Event indexer
- REST API
- WebSocket updates
- Production frontend

**Phase 2 – Reliability & SDK Integration**
- RPC stabilization
- Midl SDK integration
- Full transaction lifecycle verification
- E2E test coverage

**Phase 3 – Structured Metrics Layer**
- Risk scoring
- Momentum scoring
- Unlock schedule API
- Founder profile indexing

**Phase 4 – NFT Capital Layer**
- Allocation NFTs
- Revenue NFTs
- Milestone NFTs
- Reputation NFTs

**Phase 5 – Trading & Liquidity Suite**
- Native trading dashboard
- Liquidity routing
- Analytics expansion

**Phase 6 – Agent SDK**
- Official MidlLaunch Agent SDK
- Typed client libraries
- Simulation endpoints
- Portfolio automation

**Phase 7 – Agent Marketplace**
- Deployable agent templates
- Strategy subscription model
- Performance-based rankings

**Phase 8 – Cross-L2 Expansion**
- Multi-chain indexing
- Mirrored launches
- Cross-L2 liquidity routing

## 15. Positioning

MidlLaunch is not a token mint interface.

It is:
**A programmable capital infrastructure layer for Bitcoin L2 ecosystems.**

- Where other launchpads are event-based, MidlLaunch is system-based.
- Where others are UI-first, MidlLaunch is machine-readable.
- Where others enable issuance, MidlLaunch enables structured capital.
