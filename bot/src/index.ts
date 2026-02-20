import 'dotenv/config';
import { TwitterApi } from 'twitter-api-v2';
import { runPollCycle } from './poller';
import { startConfirmationWatcher } from './jobs';
import { getStats } from './state';

const REQUIRED_ENV = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET', 'MIDLLAUNCH_API_URL'];

async function main() {
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('[Bot] Missing required environment variables:', missing.join(', '));
    console.error('[Bot] Copy bot/.env.example to bot/.env and fill in X API credentials.');
    console.error('[Bot] Get credentials at: developer.x.com -> Your App -> Keys and Tokens');
    process.exit(1);
  }

  const client = new TwitterApi({
    appKey: process.env.X_API_KEY!,
    appSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
  });

  // Verify credentials and get bot user ID
  const me = await client.v2.me().catch(err => {
    console.error('[Bot] X API authentication failed:', (err as Error)?.message);
    console.error('[Bot] Check your credentials at developer.x.com');
    process.exit(1);
  });

  const botUserId = me.data.id;
  console.log(`[Bot] Authenticated as @${me.data.username} (ID: ${botUserId})`);

  const stats = getStats();
  console.log(`[Bot] Estimated cumulative spend: ~$${stats.estimatedCostUSD.toFixed(2)} USD`);
  console.log(`[Bot] Posts read: ${stats.totalPostsRead} | Replies sent: ${stats.totalRepliesSent}`);

  startConfirmationWatcher(client.readWrite);

  const poll = async () => {
    try {
      await runPollCycle(client.readWrite, botUserId);
    } catch (err: unknown) {
      const apiErr = err as { code?: number; rateLimit?: { reset: number }; message?: string };
      if (apiErr?.code === 429) {
        const retryAfter = apiErr.rateLimit?.reset
          ? Math.ceil((apiErr.rateLimit.reset * 1000 - Date.now()) / 1000)
          : 300;
        console.warn(`[Bot] Rate limited. Retrying in ${retryAfter}s`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
      } else {
        console.error('[Bot] Poll error:', apiErr?.message);
      }
    }
  };

  await poll();

  const interval = parseInt(process.env.POLL_INTERVAL_MS || '60000');
  setInterval(poll, interval);
  console.log(`[Bot] Polling every ${interval / 1000}s`);
}

main();
