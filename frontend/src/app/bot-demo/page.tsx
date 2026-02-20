'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

// Client-side command parser mirroring bot/src/parser.ts regex patterns
interface ParsedCommand {
  verb: 'buy' | 'sell' | 'launch' | 'portfolio' | 'help' | 'link';
  tokenSymbol?: string;
  amountBtc?: number;
  percentage?: number;
  name?: string;
  ticker?: string;
}

const RE = {
  buy:       /^buy\s+\$?([a-z0-9]{1,10})\s+([\d.]+)\s*(btc|bitcoin|sats?)?$/,
  sell:      /^sell\s+\$?([a-z0-9]{1,10})\s+([\d.]+%|all)$/,
  launch:    /^launch(?:\s+token)?\s+(.+?)\s+\(?(\$?[a-z0-9]{2,10})\)?$/,
  portfolio: /^portfolio$/,
  help:      /^help$/,
  link:      /^link(?:\s+wallet)?$/,
};

function parseCommand(raw: string): ParsedCommand | null {
  const text = raw.replace(/@midllaunchbot\b/gi, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

  const buy = text.match(RE.buy);
  if (buy) {
    const [, symbol, amountStr, unit] = buy;
    let amountBtc = parseFloat(amountStr);
    if (unit === 'sats' || unit === 'sat') amountBtc = amountBtc / 1e8;
    if (!isFinite(amountBtc) || amountBtc <= 0) return null;
    return { verb: 'buy', tokenSymbol: symbol.toUpperCase(), amountBtc };
  }
  const sell = text.match(RE.sell);
  if (sell) {
    const [, symbol, pctStr] = sell;
    const pct = pctStr === 'all' ? 100 : parseFloat(pctStr);
    return { verb: 'sell', tokenSymbol: symbol.toUpperCase(), percentage: pct };
  }
  const launch = text.match(RE.launch);
  if (launch) {
    const [, name, ticker] = launch;
    return { verb: 'launch', name: name.trim(), ticker: ticker.replace('$', '').toUpperCase() };
  }
  if (RE.portfolio.test(text)) return { verb: 'portfolio' };
  if (RE.help.test(text))      return { verb: 'help' };
  if (RE.link.test(text))      return { verb: 'link' };
  return null;
}

interface BotStats {
  jobs: { total: number; confirmed: number; expired: number; failed: number; pending: number };
  linkedWallets: number;
}

interface MockTweet {
  id: string;
  author: string;
  text: string;
  isBot: boolean;
  link?: { href: string; label: string };
}

export default function BotDemoPage() {
  const [command, setCommand] = useState('buy $PEPBTC 0.001 BTC');
  const [tweets, setTweets] = useState<MockTweet[]>([
    { id: '0', author: 'midllaunchbot', text: 'Ready to accept commands. Mention me on X to get started.', isBot: true },
  ]);
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState('');
  const [stats, setStats] = useState<BotStats | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/bot/stats`)
      .then(r => r.json())
      .then((data: BotStats) => setStats(data))
      .catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!command.trim()) return;
    setParseError('');
    setLoading(true);

    const fullCommand = command.includes('@midllaunchbot') ? command : `@midllaunchbot ${command}`;
    const parsed = parseCommand(fullCommand);

    const userTweet: MockTweet = {
      id: Date.now().toString(),
      author: 'demouser',
      text: fullCommand,
      isBot: false,
    };
    setTweets(prev => [userTweet, ...prev]);

    if (!parsed) {
      setParseError('Command not recognized. Try: buy $TOKEN 0.001 BTC');
      setLoading(false);
      const errTweet: MockTweet = {
        id: (Date.now() + 1).toString(),
        author: 'midllaunchbot',
        text: 'Not recognized. Try: @midllaunchbot buy $TOKEN 0.001 BTC or @midllaunchbot help',
        isBot: true,
      };
      setTweets(prev => [errTweet, ...prev]);
      return;
    }

    if (parsed.verb === 'help') {
      const helpTweet: MockTweet = {
        id: (Date.now() + 1).toString(),
        author: 'midllaunchbot',
        text: 'MidlLaunch bot commands:\nbuy $TOKEN 0.001 BTC\nbuy $TOKEN 100000 sats\nsell $TOKEN 50%\nlaunch MyToken ($MYT)\nportfolio\nlink',
        isBot: true,
      };
      setTweets(prev => [helpTweet, ...prev]);
      setLoading(false);
      return;
    }

    if (parsed.verb === 'link') {
      const linkTweet: MockTweet = {
        id: (Date.now() + 1).toString(),
        author: 'midllaunchbot',
        text: 'Link your wallet to your X handle (30 sec):',
        isBot: true,
        link: { href: '/link-x', label: `${APP_URL}/link-x` },
      };
      setTweets(prev => [linkTweet, ...prev]);
      setLoading(false);
      return;
    }

    // Create real job for buy/launch
    if (parsed.verb === 'buy' || parsed.verb === 'launch') {
      try {
        const fakeTweetId = `demo_${Date.now()}`;
        const res = await fetch(`${API_URL}/api/bot/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tweetId: fakeTweetId,
            xHandle: 'demouser',
            command: parsed.verb,
            intentJson: parsed,
            tokenSymbol: parsed.tokenSymbol ?? parsed.ticker,
            amountSats: parsed.amountBtc ? Math.round(parsed.amountBtc * 1e8) : null,
          }),
        });
        const data = await res.json() as { job?: { id: string }; error?: string };
        const jobId = data.job?.id;

        const signUrl = jobId ? `/bot/sign/${jobId}` : '/link-x';
        const replyText = parsed.verb === 'buy'
          ? `Sign to buy $${parsed.tokenSymbol} with ${parsed.amountBtc} BTC (expires 10min):`
          : `Deploy $${parsed.ticker} (${parsed.name}) — sign here (expires 10min):`;

        const botTweet: MockTweet = {
          id: (Date.now() + 1).toString(),
          author: 'midllaunchbot',
          text: replyText,
          isBot: true,
          link: { href: signUrl, label: `${APP_URL}${signUrl}` },
        };
        setTweets(prev => [botTweet, ...prev]);
      } catch {
        const errTweet: MockTweet = {
          id: (Date.now() + 1).toString(),
          author: 'midllaunchbot',
          text: 'API unavailable. Make sure the backend is running on port 4000.',
          isBot: true,
        };
        setTweets(prev => [errTweet, ...prev]);
      }
    } else {
      const genericTweet: MockTweet = {
        id: (Date.now() + 1).toString(),
        author: 'midllaunchbot',
        text: `Command received: ${parsed.verb}. Connect your wallet to proceed.`,
        isBot: true,
        link: { href: '/link-x', label: 'Link wallet' },
      };
      setTweets(prev => [genericTweet, ...prev]);
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen px-4 py-8">
      {/* Banner */}
      <div
        className="max-w-4xl mx-auto mb-6 rounded-xl px-4 py-3 text-sm text-center"
        style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)', color: 'var(--orange-500)' }}
      >
        DEMO MODE — In production, commands come from mentions of @midllaunchbot on X. Get started at{' '}
        <a href="https://developer.x.com" target="_blank" rel="noopener noreferrer" className="underline">
          developer.x.com
        </a>
      </div>

      {stats && (
        <div
          className="max-w-4xl mx-auto mb-4 rounded-xl px-4 py-3 flex flex-wrap gap-4 justify-center text-sm"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
        >
          {[
            { label: 'Total Jobs', value: stats.jobs.total },
            { label: 'Confirmed', value: stats.jobs.confirmed },
            { label: 'Linked Wallets', value: stats.linkedWallets },
            { label: 'Expired', value: stats.jobs.expired },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2">
              <span style={{ color: 'var(--text-tertiary)' }}>{label}:</span>
              <span className="font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-6">
        {/* Left panel: X Simulator */}
        <div className="flex-1 flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            X Simulator
          </h2>
          <div
            className="rounded-2xl p-4 flex flex-col gap-3 min-h-96 max-h-screen overflow-y-auto"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
          >
            {tweets.map(tweet => (
              <div
                key={tweet.id}
                className="rounded-xl p-3 flex flex-col gap-1 activity-item-new"
                style={{
                  background: tweet.isBot ? 'var(--bg-elevated)' : 'var(--bg-glass)',
                  border: '1px solid var(--bg-border)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: tweet.isBot ? 'var(--orange-500)' : 'var(--text-primary)' }}
                  >
                    @{tweet.author}
                  </span>
                  {tweet.isBot && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(251,146,60,0.15)', color: 'var(--orange-500)' }}>
                      bot
                    </span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
                  {tweet.text}
                </p>
                {tweet.link && (
                  <Link
                    href={tweet.link.href}
                    className="text-xs underline"
                    style={{ color: 'var(--orange-500)' }}
                  >
                    {tweet.link.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: Test a Command */}
        <div className="w-full md:w-80 flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Test a Command
          </h2>
          <div
            className="rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
          >
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                Command (without @midllaunchbot)
              </label>
              <textarea
                value={command}
                onChange={e => setCommand(e.target.value)}
                rows={3}
                className="input text-sm font-mono resize-none"
                style={{ height: 'auto' }}
                placeholder="buy $PEPBTC 0.001 BTC"
              />
            </div>

            {parseError && (
              <p className="text-xs" style={{ color: 'var(--red-500)' }}>{parseError}</p>
            )}

            <button
              onClick={handleSend}
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Sending...' : 'Send Command'}
            </button>

            <div className="border-t pt-3" style={{ borderColor: 'var(--bg-border)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Examples:
              </p>
              {[
                'buy $PEPBTC 0.001 BTC',
                'buy $PEPBTC 100000 sats',
                'sell $PEPBTC 50%',
                'launch PepeBitcoin ($PEPBTC)',
                'portfolio',
                'help',
                'link',
              ].map(ex => (
                <button
                  key={ex}
                  onClick={() => setCommand(ex)}
                  className="block text-left text-xs w-full px-2 py-1 rounded transition-colors hover:bg-white/5 font-mono"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {ex}
                </button>
              ))}
            </div>

            <Link href="/link-x" className="text-xs text-center underline" style={{ color: 'var(--text-tertiary)' }}>
              Link your wallet first
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
