# MidlLaunch Backend

Backend infrastructure for indexing MidlLaunch contract events and serving REAL data to frontend.

## Stack

- **Database**: SQLite (dev) / PostgreSQL (production)
- **Event Indexer**: Ethers.js v6 reading Midl staging network
- **API**: Express REST API
- **WebSocket**: Real-time event broadcasting
- **Cache**: Redis (optional for dev)

## Setup

```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Set environment variables
cp .env.example .env
# Edit .env with your FACTORY_ADDRESS from contracts deployment
```

## Running Services

### API Server (REST endpoints)
```bash
npm run api
# Runs on http://localhost:3001
```

### Event Indexer
```bash
npm run indexer
# Polls Midl staging network for contract events
# Stores in database
# Broadcasts via Redis for WebSocket
```

### WebSocket Server
```bash
npm run ws
# Runs on ws://localhost:8080
# Requires Redis for pub/sub
```

## API Endpoints

### GET /api/launches
List all launches with filtering and sorting.

Query params:
- `status`: 'active' | 'finalized'
- `sortBy`: 'newest' | 'price_low' | 'price_high'
- `limit`: number (default 20)
- `offset`: number (default 0)

### GET /api/launches/:tokenAddress
Get detailed launch info including current price, supply, purchases.

### GET /api/launches/:tokenAddress/purchases
Get purchase history for a launch.

### GET /api/launches/:tokenAddress/chart
Get price/supply data points for charting.

### GET /api/user/:address/holdings
Get user's token holdings across all launches.

### GET /api/user/:address/activity
Get user's purchase history.

### GET /api/stats
Get global statistics (total launches, volume, etc.).

## WebSocket Events

Clients can subscribe to channels:
- `global`: All launches
- `launch:{tokenAddress}`: Specific launch

Event types:
- `launch_created`: New launch deployed
- `tokens_purchased`: New purchase on any launch
- `price_update`: Price changed for launch
- `launch_finalized`: Launch sold out

## Data Flow

```
Midl Staging Network
    ↓ (RPC polling)
Event Indexer
    ↓ (writes)
SQLite/PostgreSQL Database
    ↓ (reads)
REST API ← Frontend
    ↓ (pub/sub)
Redis
    ↓ (broadcast)
WebSocket ← Frontend (real-time)
```

## NO MOCK DATA

All data comes from REAL contract events on Midl staging network. The indexer reads:
- `LaunchCreated` events from LaunchFactory
- `TokensPurchased` events from BondingCurvePrimaryMarket
- `LaunchFinalized` events from BondingCurvePrimaryMarket

Frontend consumes REAL indexed data via API and WebSocket.
