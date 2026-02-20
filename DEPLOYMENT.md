# MidlLaunch Deployment Guide

## Phase 2: Midl Staging Deployment

### Prerequisites

1. **Midl Staging Access:**
   - RPC endpoint: `https://rpc.staging.midl.xyz`
   - Faucet: `https://faucet.midl.xyz` (get staging BTC)
   - BTC Explorer: `https://mempool.staging.midl.xyz`
   - Midl Explorer: `https://blockscout.staging.midl.xyz`

2. **Environment Setup:**
   ```bash
   cp .env.example .env
   # Edit .env with your private key and parameters
   ```

3. **Required Information:**
   - Midl staging chain ID (obtain from Midl team)
   - Private key with staging BTC balance
   - Fee recipient address

### Deployment Steps

#### 1. Compile Contracts
```bash
npm run compile
```

#### 2. Run Tests (Local)
```bash
npm test
```

Expected output: **16/16 tests passing**

#### 3. Deploy to Midl Staging
```bash
npm run deploy:staging
```

This will:
- Deploy `LaunchFactory` contract
- Output deployed address
- Provide Blockscout verification URL

**Save the factory address** - you'll need it for testing and frontend configuration.

#### 4. Verify on Blockscout
After deployment, verify the contract:
1. Visit the Blockscout URL from deployment output
2. Contract should appear with full source code
3. Verify events are being emitted correctly

#### 5. Test Launch Creation and Purchase
```bash
export FACTORY_ADDRESS=<your_deployed_factory_address>
npm run test:launch
```

This script will:
1. Create a test token launch
2. Perform a test purchase
3. Output **proof links** for both Bitcoin and Midl explorers

### Proof Verification Checklist (Phase 2.4-2.5)

For **every action** (launch creation, token purchase), verify:

#### Bitcoin Layer (Section 9.9 - FBT)
- [ ] FBT visible on `https://mempool.staging.midl.xyz/tx/[txid]`
- [ ] Transaction has ≥1 confirmation (staging: N=1)
- [ ] BTC sent to correct address

#### Midl Execution Layer (Section 9.9)
- [ ] Execution tx visible on `https://blockscout.staging.midl.xyz/tx/[txid]`
- [ ] Events emitted with correct parameters
- [ ] `intentId` correlation present in events (Section 9.8)

#### State Correctness
- [ ] Token supply updated correctly
- [ ] Price increased (monotonic invariant)
- [ ] User balance reflects purchase
- [ ] `totalBTCDepositedSats` updated

### Settlement Model Validation (Phase 2.4)

Per PRD Section 9, validate:

1. **msg.value semantics (Section 9.3):**
   - Verify contract receives credited satoshis
   - Confirm gross vs net fee accounting

2. **Refund handling (Section 9.5):**
   - Intentionally trigger a revert (e.g., slippage exceeded)
   - Verify async RBT (Return BTC Transaction) is produced
   - **NOT** instant revert refund (this would indicate Ethereum mental model leak)

3. **Event correlation (Section 9.8):**
   - Every `LaunchCreated` and `TokensPurchased` event includes `intentId`
   - `intentId` can be correlated to FBT txid

### Common Issues

#### "Insufficient funds" error
- Check staging BTC balance: `https://faucet.midl.xyz`
- Ensure private key is correctly set in `.env`

#### "Transaction reverted" on launch creation
- Verify parameters are within PRD Section 8 bounds:
  - `basePrice`: [1,000, 1,000,000] sats
  - `priceIncrement`: [1, 10,000] sats
  - `supplyCap`: [1M, 21M] tokens

#### Contract not appearing on Blockscout
- Wait for 1-2 block confirmations
- Check if staging Blockscout is indexing correctly
- Verify RPC endpoint is correct

### Output Format for Submission

After successful deployment and test, document:

```
MIDLLAUNCH STAGING DEPLOYMENT PROOF

Factory Address: 0x...
Deployed at: <timestamp>
Chain ID: <midl_staging_chain_id>

CREATE LAUNCH PROOF:
- FBT (Bitcoin): https://mempool.staging.midl.xyz/tx/[txid]
- Execution (Midl): https://blockscout.staging.midl.xyz/tx/[txid]
- Token Address: 0x...
- Curve Address: 0x...

BUY TOKENS PROOF:
- FBT (Bitcoin): https://mempool.staging.midl.xyz/tx/[txid]
- Execution (Midl): https://blockscout.staging.midl.xyz/tx/[txid]
- Tokens Received: X.XX MTEST
- New Supply: Y.YY tokens
- New Price: Z sats/token
```

### Next Steps

After staging validation, proceed to Phase 3: Frontend + UX
