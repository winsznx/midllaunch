# MidlLaunch — Contract Deployment Guide

This project uses **Hardhat** with the `@midl/hardhat-deploy` plugin. Every deploy is a dual-settlement transaction: one BTC transaction (visible on mempool) and one EVM transaction (visible on Blockscout). Do **not** use Foundry/forge — it is not configured for this project.

---

## Network

| Property | Value |
|----------|-------|
| Network name | `midlStaging` |
| Chain ID | `15001` |
| EVM RPC | `https://rpc.staging.midl.xyz` |
| BTC mempool | `https://mempool.staging.midl.xyz` |
| Blockscout | `https://blockscout.staging.midl.xyz` |
| Faucet | `https://faucet.midl.xyz` |
| Runes provider | `https://runes.staging.midl.xyz` |

---

## Prerequisites

1. **BTC balance** — get staging BTC from `https://faucet.midl.xyz`
   - Deployer wallet needs **≥ 10,000 sats** per contract deployment
   - Three contracts = budget at least 50,000 sats to be safe

2. **MNEMONIC** — the BIP39 mnemonic for your deployer wallet, set as a Hardhat config variable:
   ```bash
   npx hardhat vars set MNEMONIC
   # paste your mnemonic when prompted
   ```
   This is stored encrypted in `~/.hardhat/vars.json`, not in `.env`.

3. **FEE_RECIPIENT** — the EVM address that receives protocol fees:
   ```bash
   # Set in root .env (not tracked in git)
   echo "FEE_RECIPIENT=0xYourAddress" >> .env
   ```

4. **PROTOCOL_FEE_RATE** (optional) — fee in basis points, defaults to `50` (0.5%):
   ```bash
   echo "PROTOCOL_FEE_RATE=50" >> .env
   ```

---

## Deploy Flow

### 1. Compile

```bash
npm run compile
# or: npx hardhat compile
```

Artifacts are written to `artifacts/`. If you changed any contract, always recompile before deploying — `LaunchFactory` embeds `LaunchToken` and `BondingCurvePrimaryMarket` bytecode at compile time, so a recompile is required to pick up changes to those contracts.

### 2. Run Tests

```bash
npm test
# or: npx hardhat test
```

Expected: **24 tests passing**. Do not deploy if tests fail.

### 3. Clear Cached Deployments (redeploy only)

`@midl/hardhat-deploy` caches each deployed contract in `deployments/<ContractName>.json`. If a file exists, the deploy script will return the cached address without redeploying.

**To force a fresh deploy for all contracts:**
```bash
rm deployments/LaunchFactory.json deployments/NftFactory.json deployments/NftMarketplace.json
```

**To force redeploy of a single contract:**
```bash
rm deployments/LaunchFactory.json
```

> **Warning:** If a deploy fails mid-run, the partially written JSON may contain a wrong address. Always inspect or delete the file before retrying.

### 4. Deploy

```bash
npm run deploy:staging
# or: npx hardhat run scripts/deploy.ts --network midlStaging
```

The script deploys three contracts in order:

1. **LaunchFactory** (`[protocolFeeRate, feeRecipient]`) — gas: 5,000,000
2. **NftFactory** (no constructor args) — gas: 5,000,000
3. **NftMarketplace** (no constructor args) — gas: 3,000,000

Each step calls `hre.midl.deploy()` then `hre.midl.execute()`. The execute step submits the BTC transaction and waits for the required confirmations (`btcConfirmationsRequired: 1` on staging).

**Successful output looks like:**
```
[1/3] Deploying LaunchFactory...
      ✓ LaunchFactory: 0x...

[2/3] Deploying NftFactory...
      ✓ NftFactory:    0x...

[3/3] Deploying NftMarketplace...
      ✓ NftMarketplace: 0x...

══════════════════════════════════════════════════════
DEPLOYMENT COMPLETE
══════════════════════════════════════════════════════

Explorer:
  https://blockscout.staging.midl.xyz/address/0x...
  https://blockscout.staging.midl.xyz/address/0x...
  https://blockscout.staging.midl.xyz/address/0x...

Env snippet written to: deployments/env-update.txt
```

### 5. Update Environment Variables

After deploy, `deployments/env-update.txt` is written with ready-to-paste snippets. Copy them into the relevant files:

**`backend/.env`:**
```
FACTORY_ADDRESS=0x...
NFT_FACTORY_ADDRESS=0x...
NFT_MARKETPLACE_ADDRESS=0x...
START_BLOCK=0
```

**`frontend/.env.local`:**
```
NEXT_PUBLIC_LAUNCH_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_NFT_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_NFT_MARKETPLACE_ADDRESS=0x...
```

### 6. Verify on Explorers

Each deployment artifact (`deployments/*.json`) contains three fields:

```json
{
  "address": "0x...",
  "txId": "0x...",
  "btcTxId": "abc123..."
}
```

Use these to verify both layers:

| Field | Explorer |
|-------|----------|
| `address` | `https://blockscout.staging.midl.xyz/address/{address}` |
| `txId` | `https://blockscout.staging.midl.xyz/tx/{txId}` |
| `btcTxId` | `https://mempool.staging.midl.xyz/tx/{btcTxId}` |

---

## Currently Deployed (Midl Staging)

| Contract | Address |
|----------|---------|
| LaunchFactory | `0x25FE7EF91B9C4c79f1Ad46b7419d9db935ee24b1` |
| NftFactory | `0x06b81d8607E2C984513A763206B80048A9d584F8` |
| NftMarketplace | `0x9E312623C309d749Ceb50a954E0094502808288d` |

**LaunchFactory**
- Contract: https://blockscout.staging.midl.xyz/address/0x25FE7EF91B9C4c79f1Ad46b7419d9db935ee24b1
- EVM tx: https://blockscout.staging.midl.xyz/tx/0x2cd78eb98510db3f657776994573af16d1fc16b7014a960a09b511835d8bb0e2
- BTC tx: https://mempool.staging.midl.xyz/tx/e74a36d440506c651d1ef72b2f92d108b85af24f5b32ac578ea822f5a420ef60

**NftFactory**
- Contract: https://blockscout.staging.midl.xyz/address/0x06b81d8607E2C984513A763206B80048A9d584F8
- EVM tx: https://blockscout.staging.midl.xyz/tx/0x2997b0fcb5228333064f7923fad704a89b077c18cafb68aae89735f8e880fb63
- BTC tx: https://mempool.staging.midl.xyz/tx/afb2b58aa7fb6a0896eb9bcf1fc32e9d484706ecc09de82da52aa70eea68e93b

**NftMarketplace**
- Contract: https://blockscout.staging.midl.xyz/address/0x9E312623C309d749Ceb50a954E0094502808288d
- EVM tx: https://blockscout.staging.midl.xyz/tx/0x4138c73037fd55e70902ba3b8d93b92537f347592c9416968395c9797658ac1a
- BTC tx: https://mempool.staging.midl.xyz/tx/ab19c2305f9072bb8e6eb82ca3ead941d0f80dd5cc660b414a6f339736610fe6

---

## ABI Sync

After recompiling, sync the frontend ABI files from Hardhat artifacts:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const contracts = ['LaunchFactory','LaunchToken','BondingCurvePrimaryMarket','NftFactory','MidlNFT','NftMarketplace'];
contracts.forEach(name => {
  const src = path.join('artifacts','contracts',name+'.sol',name+'.json');
  const dest = path.join('frontend','src','lib','contracts',name+'.abi.json');
  const { abi } = JSON.parse(fs.readFileSync(src,'utf8'));
  fs.writeFileSync(dest, JSON.stringify(abi, null, 2));
  console.log('synced', name);
});
"
```

Run this any time contracts are recompiled before redeploying.

---

## Common Issues

### "Insufficient BTC" error
- Top up deployer wallet at `https://faucet.midl.xyz`
- Need ≥ 10,000 sats confirmed per contract deploy

### Deploy returns cached address (no new deploy happened)
- `deployments/<ContractName>.json` exists from a previous deploy
- Delete the file and rerun (see step 3 above)

### Partial deploy — one contract deployed but next failed
- A corrupt `.json` may have been written with a wrong address
- Inspect `deployments/<FailedContract>.json` — if `address` matches a different contract or is `0x0000...`, delete it
- Fix the underlying issue (usually network/balance), then rerun

### WebSocket / network timeout during execute()
- Transient network error on Midl staging
- Check `deployments/` for a corrupt partial file from the failed run, delete it, and retry

### "stack too deep" compile error
- `viaIR: true` is already set in `hardhat.config.ts` — this should not occur
- If it does, run `npm run clean` then `npm run compile`

### Contract not appearing on Blockscout
- Wait 1–2 block confirmations
- Verify the `txId` from `deployments/<ContractName>.json` on Blockscout directly

---

## Proof Verification Checklist

For each deployed contract, verify both layers:

**Bitcoin layer (mempool):**
- [ ] `btcTxId` visible at `https://mempool.staging.midl.xyz/tx/{btcTxId}`
- [ ] Transaction has ≥ 1 confirmation

**EVM layer (Blockscout):**
- [ ] Contract visible at `https://blockscout.staging.midl.xyz/address/{address}`
- [ ] Deploy tx visible at `https://blockscout.staging.midl.xyz/tx/{txId}`
- [ ] Contract bytecode non-empty (not a failed deploy)
