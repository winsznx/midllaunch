import { TwitterApiReadWrite } from 'twitter-api-v2';
import { recordUsage } from './state';

// In-memory dedup: never reply twice to the same source tweet
const repliedTweets = new Set<string>();

export async function reply(
  client: TwitterApiReadWrite,
  tweetId: string,
  text: string
): Promise<string | null> {
  if (repliedTweets.has(tweetId)) {
    console.log(`[Replier] Already replied to ${tweetId} — skipping`);
    return null;
  }

  try {
    const result = await client.v2.reply(text, tweetId);
    repliedTweets.add(tweetId);
    recordUsage(0, 1); // $0.010 per reply
    console.log(`[Replier] Posted reply to ${tweetId}: "${text.slice(0, 60)}..."`);
    return result.data.id;
  } catch (err: unknown) {
    const apiErr = err as { code?: number; message?: string; rateLimit?: { reset: number } };
    if (apiErr?.code === 429) {
      console.error('[Replier] Rate limited on reply — propagating');
      throw err;
    }
    if (apiErr?.code === 403) {
      console.error('[Replier] 403 on reply — check app write permissions in developer.x.com');
      return null;
    }
    console.error(`[Replier] Failed to reply to ${tweetId}:`, apiErr?.message);
    return null;
  }
}
