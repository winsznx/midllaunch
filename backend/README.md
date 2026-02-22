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

## Mutating Endpoints (Requires Authentication)

To prevent unauthorized database modifications, all endpoints that mutate token metadata or post comments **require cryptographic signature authentication**.

You do not need a session or an API key. You must construct an `auth` object in your JSON body proving that you own the wallet address (e.g. the token creator's address) by signing a specific message using your Bitcoin wallet (Unisat, Xverse, Leather, etc.).

**Required `auth` payload:**
```json
{
  "auth": {
    "address": "bc1q...",
    "message": "I am the creator of [tokenAddress]",
    "signature": "H8yAIxMVQfVcY4J..." // Base64 signature from your wallet
  }
}
```

### PATCH /api/launches/:tokenAddress/metadata
Updates off-chain metadata (Twitter, Telegram, Website, Description). 
* **Auth Requirement:** `auth.address` must mathematically match the Launch's `creator` address.

### PATCH /api/nft-launches/:address/metadata
Updates off-chain metadata for an NFT Collection.
* **Auth Requirement:** `auth.address` must mathematically match the NFT Collection's `creatorAddress`.

### POST /api/launches/:tokenAddress/comments
Posts a new comment to a Token's discussion thread.
* **Auth Requirement:** `auth.address` must match the `author` field in the request body.

---

### Example: Testing via cURL
If you are testing the API without the frontend UI, you can manually generate a signature.
1. Open your Bitcoin wallet extension (e.g., Unisat).
2. Look for **"Sign Message"** in the Settings.
3. Type a message, e.g., `"Update my token"`, and click **Sign**.
4. Copy the resulting Base64 Signature string.

```bash
curl -X PATCH http://localhost:4000/api/launches/YOUR_TOKEN_ADDRESS/metadata \
     -H "Content-Type: application/json" \
     -d '{
       "twitterUrl": "https://x.com/newlink",
       "auth": {
         "address": "YOUR_WALLET_ADDRESS",
         "message": "Update my token",
         "signature": "PASTE_THE_SIGNATURE_HERE"
       }
     }'
```

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
