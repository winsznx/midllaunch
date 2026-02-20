// Polls for CONFIRMED jobs every 10 seconds and posts the final X reply with proof.
// This is the "transaction confirmed" -> "bot posts receipt" leg of the flow.

import { TwitterApiReadWrite } from 'twitter-api-v2';
import { reply } from './replier';
import { T } from './templates';

const API = () => process.env.MIDLLAUNCH_API_URL!;

export function startConfirmationWatcher(rwClient: TwitterApiReadWrite) {
  const check = async () => {
    try {
      const res = await fetch(`${API()}/api/bot/jobs/recently-confirmed`);
      if (!res.ok) return;
      const { jobs } = await res.json() as { jobs: Array<{
        id: string;
        replyTweetId: string | null;
        command: string;
        txHash: string | null;
        intentJson: string;
        amountSats: string | null;
        tokenSymbol: string | null;
        launchAddress: string | null;
        tweetId: string;
      }> };

      for (const job of jobs) {
        if (job.replyTweetId) continue;

        let text = '';
        const intent = (() => {
          try { return JSON.parse(job.intentJson) as Record<string, unknown>; }
          catch { return {}; }
        })();

        if (job.command === 'buy' && job.txHash) {
          const tokens = intent['tokensReceived']
            ? Number(intent['tokensReceived']).toLocaleString()
            : '?';
          const btc = job.amountSats ? (Number(job.amountSats) / 1e8) : 0;
          text = T.buyDone(job.tokenSymbol ?? '', tokens, btc, job.launchAddress ?? '', job.txHash);
        }

        if (job.command === 'launch' && job.launchAddress) {
          const name = (intent['name'] as string | undefined) ?? job.tokenSymbol ?? '';
          text = T.launchDone(name, job.tokenSymbol ?? '', job.launchAddress);
        }

        if (!text || !job.tweetId) continue;

        const replyId = await reply(rwClient, job.tweetId, text);
        if (replyId) {
          await fetch(`${API()}/api/bot/jobs/${job.id}/mark-replied`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ replyTweetId: replyId }),
          });
        }
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('[Jobs] Confirmation watcher error:', e?.message);
    }
  };

  setInterval(check, 10_000);
  console.log('[Jobs] Confirmation watcher started');

  const checkExpired = async () => {
    try {
      const res = await fetch(`${API()}/api/bot/jobs/recently-expired`);
      if (!res.ok) return;
      const { jobs } = await res.json() as { jobs: Array<{
        id: string;
        tweetId: string | null;
        tokenSymbol: string | null;
        expiryReplyTweetId: string | null;
      }> };

      for (const job of jobs) {
        if (!job.tweetId) continue;
        const text = T.expired(job.tokenSymbol ?? 'your token');
        const replyId = await reply(rwClient, job.tweetId, text).catch(() => null);
        if (replyId) {
          await fetch(`${API()}/api/bot/jobs/${job.id}/mark-expiry-replied`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ replyTweetId: replyId }),
          });
        }
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('[Jobs] Expiry watcher error:', e?.message);
    }
  };

  setInterval(checkExpired, 30_000);
  console.log('[Jobs] Expiry watcher started');
}
