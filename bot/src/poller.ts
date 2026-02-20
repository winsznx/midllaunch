import { TwitterApiReadWrite } from 'twitter-api-v2';
import { getSinceId, saveSinceId, recordUsage } from './state';
import { parseCommand, ParsedCommand } from './parser';
import { reply } from './replier';
import { T } from './templates';

const API = () => process.env.MIDLLAUNCH_API_URL!;

async function fetchJSON<R>(url: string, opts?: RequestInit): Promise<R> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(`${opts?.method ?? 'GET'} ${url} -> ${res.status}`);
  return res.json() as Promise<R>;
}

export async function runPollCycle(rwClient: TwitterApiReadWrite, botUserId: string) {
  const sinceId = getSinceId();

  // Expire old jobs before processing new ones
  await fetch(`${API()}/api/bot/jobs/expire-old`, { method: 'POST' }).catch(() => {});

  const params: Record<string, string | number> = {
    max_results: 10,
    'tweet.fields': 'text,author_id,created_at',
    'user.fields': 'username',
    expansions: 'author_id',
  };
  if (sinceId) params.since_id = sinceId;

  // GET /2/users/:id/mentions
  // Cost: $0.005 per post RETURNED. If 0 new mentions -> $0.
  const mentions = await rwClient.v2.userMentionTimeline(botUserId, params);

  const tweets = mentions.data?.data;
  if (!tweets?.length) return;

  // Update sinceId to newest tweet (Twitter returns newest first)
  saveSinceId(tweets[0].id);
  recordUsage(tweets.length, 0);

  // Build userId -> username map from expansions
  const userMap = new Map<string, string>();
  for (const user of mentions.data?.includes?.users ?? []) {
    userMap.set(user.id, user.username);
  }

  // Process in chronological order (oldest first)
  for (const tweet of [...tweets].reverse()) {
    if (tweet.author_id === botUserId) continue;

    const xHandle = userMap.get(tweet.author_id ?? '') ?? 'unknown';
    console.log(`[Poller] @${xHandle}: "${tweet.text}"`);

    const command = parseCommand(tweet.text);
    if (!command) {
      const cleanedText = tweet.text.replace(/@midllaunchbot/gi, '').trim();
      if (cleanedText.split(' ').length >= 2) {
        await reply(rwClient, tweet.id, T.badSyntax()).catch(() => {});
      }
      continue;
    }

    await processCommand(rwClient, tweet.id, xHandle, command);
  }
}

async function processCommand(
  rwClient: TwitterApiReadWrite,
  tweetId: string,
  xHandle: string,
  cmd: ParsedCommand
) {
  try {
    if (cmd.verb === 'help') {
      await reply(rwClient, tweetId, T.help());
      return;
    }

    if (cmd.verb === 'link') {
      await reply(rwClient, tweetId, T.noWallet());
      return;
    }

    // All trade/launch commands require a linked wallet
    const walletData = await fetchJSON<{ btcAddress: string } | null>(
      `${API()}/api/bot/wallet/${xHandle}`
    ).catch(() => null);

    if (!walletData) {
      await reply(rwClient, tweetId, T.noWallet());
      return;
    }

    if (cmd.verb === 'portfolio') {
      const { holdings } = await fetchJSON<{ holdings: Array<{ totalTokens: string; symbol: string; amountSats?: string }> }>(
        `${API()}/api/user/${walletData.btcAddress}/holdings`
      );
      if (!holdings?.length) {
        await reply(rwClient, tweetId, T.portfolioEmpty(xHandle));
        return;
      }
      const lines = holdings.slice(0, 3).map(h => `${h.totalTokens} $${h.symbol}`).join('\n');
      const totalBtc = holdings
        .reduce((s, h) => s + (Number(h.amountSats ?? 0) / 1e8), 0)
        .toFixed(6);
      await reply(rwClient, tweetId, T.portfolio(xHandle, totalBtc, lines));
      return;
    }

    if (cmd.verb === 'buy') {
      // Step 1: Look up token
      const { launches } = await fetchJSON<{ launches: Array<{ symbol: string; status: string; totalSupplySold?: string; supplyCap: string; tokenAddress: string; basePrice?: string; priceIncrement?: string }> }>(
        `${API()}/api/launches/search?q=${cmd.tokenSymbol}`
      );
      const launch = launches?.find(l => l.symbol === cmd.tokenSymbol);

      if (!launch) {
        await reply(rwClient, tweetId, T.noToken(cmd.tokenSymbol));
        return;
      }

      // Step 2: Check graduation
      if (launch.status === 'FINALIZED' || Number(launch.totalSupplySold) >= Number(launch.supplyCap)) {
        await reply(rwClient, tweetId, T.graduated(cmd.tokenSymbol));
        return;
      }

      // Step 3: Pre-calculate estimate using linear bonding curve math
      // Conservative: use current price (not midpoint) to never overpromise
      const amountSats = Math.round(cmd.amountBtc * 1e8);
      const basePrice = Number(launch.basePrice ?? 1000);
      const priceIncrement = Number(launch.priceIncrement ?? 100);
      const currentSupply = Number(launch.totalSupplySold ?? 0);
      const currentPrice = basePrice + currentSupply * priceIncrement;
      const estimatedTokens = Math.floor(amountSats / currentPrice);
      const minTokens = Math.floor(estimatedTokens * 0.99); // 1% slippage

      // Step 4: Create job with estimate baked in
      const { job } = await fetchJSON<{ job: { id: string } }>(`${API()}/api/bot/jobs`, {
        method: 'POST',
        body: JSON.stringify({
          tweetId,
          xHandle,
          command: 'buy',
          intentJson: {
            verb: 'buy',
            tokenSymbol: cmd.tokenSymbol,
            amountBtc: cmd.amountBtc,
            launchAddress: launch.tokenAddress,
            estimatedTokens,
            minTokens,
            currentPriceSats: currentPrice,
          },
          launchAddress: launch.tokenAddress,
          tokenSymbol: cmd.tokenSymbol,
          amountSats,
        }),
      });

      // Step 5: Reply with estimate included
      await reply(rwClient, tweetId, T.buySign(cmd.tokenSymbol, cmd.amountBtc, estimatedTokens, minTokens, job.id));

      await fetch(`${API()}/api/bot/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'AWAITING_SIGNATURE', walletAddress: walletData.btcAddress }),
      }).catch(() => {});
      return;
    }

    if (cmd.verb === 'launch') {
      const { job } = await fetchJSON<{ job: { id: string } }>(`${API()}/api/bot/jobs`, {
        method: 'POST',
        body: JSON.stringify({
          tweetId,
          xHandle,
          command: 'launch',
          intentJson: { verb: 'launch', name: cmd.name, ticker: cmd.ticker },
          tokenSymbol: cmd.ticker,
        }),
      });
      await reply(rwClient, tweetId, T.launchSign(cmd.name, cmd.ticker, job.id));
      await fetch(`${API()}/api/bot/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'AWAITING_SIGNATURE', walletAddress: walletData.btcAddress }),
      }).catch(() => {});
      return;
    }

  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error(`[Poller] Error processing @${xHandle} command:`, e?.message);
  }
}
