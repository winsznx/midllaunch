// Strict regex parsing only. No NLP. No ambiguity.
// If a command doesn't exactly match a pattern, it returns null — silently ignored.

export type ParsedCommand =
  | { verb: 'buy';       tokenSymbol: string; amountBtc: number }
  | { verb: 'sell';      tokenSymbol: string; percentage: number }
  | { verb: 'launch';    name: string; ticker: string }
  | { verb: 'portfolio' }
  | { verb: 'help' }
  | { verb: 'link' };

// Strips @midllaunchbot mention, URLs, and extra whitespace
function cleanText(raw: string): string {
  return raw
    .replace(/@midllaunchbot\b/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const RE = {
  buy:       /^buy\s+\$?([a-z0-9]{1,10})\s+([\d.]+)\s*(btc|bitcoin|sats?)?$/,
  sell:      /^sell\s+\$?([a-z0-9]{1,10})\s+([\d.]+%|all)$/,
  launch:    /^launch(?:\s+token)?\s+(.+?)\s+\(?(\$?[a-z0-9]{2,10})\)?$/,
  portfolio: /^portfolio$/,
  help:      /^help$/,
  link:      /^link(?:\s+wallet)?$/,
};

export function parseCommand(rawText: string): ParsedCommand | null {
  const text = cleanText(rawText);

  const buy = text.match(RE.buy);
  if (buy) {
    const [, symbol, amountStr, unit] = buy;
    let amountBtc = parseFloat(amountStr);
    if (unit === 'sats' || unit === 'sat') amountBtc = amountBtc / 1e8;
    if (!isFinite(amountBtc) || amountBtc <= 0) return null;
    const max = parseFloat(process.env.MAX_TRADE_BTC || '0.1');
    if (amountBtc > max) return null;
    return { verb: 'buy', tokenSymbol: symbol.toUpperCase(), amountBtc };
  }

  const sell = text.match(RE.sell);
  if (sell) {
    const [, symbol, pctStr] = sell;
    const pct = pctStr === 'all' ? 100 : parseFloat(pctStr);
    if (!isFinite(pct) || pct <= 0 || pct > 100) return null;
    return { verb: 'sell', tokenSymbol: symbol.toUpperCase(), percentage: pct };
  }

  const launch = text.match(RE.launch);
  if (launch) {
    const [, name, ticker] = launch;
    return {
      verb: 'launch',
      name: name.trim().replace(/\(|\)/g, '').trim(),
      ticker: ticker.replace('$', '').toUpperCase(),
    };
  }

  if (RE.portfolio.test(text)) return { verb: 'portfolio' };
  if (RE.help.test(text))      return { verb: 'help' };
  if (RE.link.test(text))      return { verb: 'link' };

  return null;
}

export const COMMAND_DOCS = [
  '@midllaunchbot buy $PEPBTC 0.001 BTC',
  '@midllaunchbot buy $PEPBTC 100000 sats',
  '@midllaunchbot sell $PEPBTC 50%',
  '@midllaunchbot sell $PEPBTC all',
  '@midllaunchbot launch PepeBitcoin ($PEPBTC)',
  '@midllaunchbot portfolio',
  '@midllaunchbot link    <- connects your wallet to your X handle',
];
