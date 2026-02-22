transaction page should sh# Task Plan: MidlLaunch Bug Fixes

## Goal
Fix all identified UI/UX and data issues across token launch detail page, NFT lifecycle, and transactions page.

## Issues

### Issue 1: Token Launch Detail Page — UI blocked / not clickable
- Background image fills the whole page and may sit on top of the UI (z-index / pointer-events issue)
- Buy/Sell panel, bonding curve link, token address link — all unclickable
- Panel stops rendering entirely after some time
- [ ] Investigate `launch/[address]/page.tsx` layout + image z-index
- [ ] Fix pointer-events so overlapping image doesn't block interaction
- [ ] Verify buy/sell panel renders correctly

### Issue 2: NFT Lifecycle — imageCID not stored
- `launch-nft/page.tsx` already hardcodes `imageUrl: https://gateway.pinata.cloud/ipfs/${imageCID}` in the DB call
- But check: does `pending-metadata` for NFTs also pass `imageCID`?
- Does the NFT indexer path set `imageUrl` correctly?
- [ ] Read `launch-nft/page.tsx` create flow
- [ ] Read NFT indexer path in `backend/src/indexer/index.ts`
- [ ] Check `NftLaunch` model has `imageUrl`
- [ ] Fix if missing

### Issue 3: Transactions Page — No transactions showing
- Wallet connected (4.49998566 BTC balance shown)
- Transactions page shows "No transactions yet"
- Need to check: what data source does the page use, what does the API return for this wallet
- [ ] Read `transactions/page.tsx`
- [ ] Check API endpoint for transactions
- [ ] Test API with the connected wallet address
- [ ] Fix if data isn't being indexed or queried correctly

## Status
**Starting** — reading files for all three issues in parallel

## Errors Encountered
(none yet)
