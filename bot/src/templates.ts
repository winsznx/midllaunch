import { COMMAND_DOCS } from './parser';

const APP = () => process.env.MIDLLAUNCH_APP_URL || 'https://midllaunch.xyz';

export const T = {
  // Sent immediately on valid buy command — includes pre-calculated estimate
  buySign: (symbol: string, btc: number, estimatedTokens: number, minTokens: number, jobId: string) =>
    `Buy ~${estimatedTokens.toLocaleString()} $${symbol} for ${btc} BTC\nMin guaranteed: ${minTokens.toLocaleString()} (1% slippage)\n\nSign here (10min): ${APP()}/bot/sign/${jobId}?ref=x`,

  // Sent when buy tx confirms on-chain
  buyDone: (symbol: string, tokens: string, btc: number, launchAddr: string, evmTx: string) =>
    `Bought ${tokens} $${symbol} for ${btc} BTC\n\nTrade: ${APP()}/launch/${launchAddr}\nProof: blockscout.staging.midl.xyz/tx/${evmTx.slice(0, 16)}...`,

  // No wallet linked
  noWallet: () =>
    `No wallet linked to your X handle.\n\nLink it (30 sec): ${APP()}/link-x\n\nThen retry your command.`,

  // Launch sign
  launchSign: (name: string, ticker: string, jobId: string) =>
    `Deploy $${ticker} (${name}) — sign here (expires 10min):\n${APP()}/bot/sign/${jobId}?ref=x`,

  // Launch confirmed
  launchDone: (name: string, ticker: string, contractAddr: string) =>
    `$${ticker} (${name}) is live.\n\nTrade: ${APP()}/launch/${contractAddr}\nContract: ${contractAddr.slice(0, 12)}...`,

  // Token not found
  noToken: (symbol: string) =>
    `$${symbol} not found on MidlLaunch.\n\nBrowse: ${APP()}/launches`,

  // Graduated token (fully sold)
  graduated: (symbol: string) =>
    `$${symbol} is fully subscribed. The bonding curve is closed.\n\nBrowse other launches: ${APP()}/launches`,

  // Portfolio summary
  portfolio: (handle: string, valueBtc: string, lines: string) =>
    `@${handle} portfolio\nValue: ${valueBtc} BTC\n${lines}\n\nFull view: ${APP()}/portfolio`,

  // Empty portfolio
  portfolioEmpty: (handle: string) =>
    `@${handle} has no token holdings yet.\n\nBuy your first: ${APP()}/launches`,

  // Job expired
  expired: (symbol: string) =>
    `Your $${symbol} request expired (10min limit). Send the command again when ready.`,

  // Tx failed on-chain
  txFailed: (reason: string) =>
    `Transaction failed: ${reason}\n\nNo BTC spent. Try again: ${APP()}/launches`,

  // Help
  help: () =>
    `MidlLaunch bot — commands:\n${COMMAND_DOCS.slice(0, 4).join('\n')}\n\nMore: ${APP()}`,

  // Sent immediately on valid sell command
  sellSign: (symbol: string, tokenAmount: string, expectedBtc: number, minBtcSats: string, jobId: string) =>
    `Sell ${tokenAmount} $${symbol} → ~${expectedBtc.toFixed(6)} BTC\nMin guaranteed: ${(Number(minBtcSats) / 1e8).toFixed(6)} BTC (1% slippage)\n\nSign here (10min): ${APP()}/bot/sign/${jobId}?ref=x`,

  // Sent when sell tx confirms on-chain
  sellDone: (symbol: string, tokenAmount: string, btcReceived: number, evmTx: string) =>
    `Sold ${tokenAmount} $${symbol} → ${btcReceived.toFixed(6)} BTC returned\n\nProof: blockscout.staging.midl.xyz/tx/${evmTx.slice(0, 16)}...`,

  // No holdings for this token
  noHolding: (symbol: string) =>
    `You don't hold any $${symbol}.\n\nBuy some first: ${APP()}/launches`,

  // Bad command syntax
  badSyntax: () =>
    `Not recognized. Try:\n@midllaunchbot buy $TOKEN 0.001 BTC\n@midllaunchbot help`,
};
