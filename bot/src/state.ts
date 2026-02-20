import fs from 'fs';
import path from 'path';

const STATE_FILE = path.join(process.cwd(), 'bot-state.json');

interface BotState {
  sinceId?: string;
  updatedAt?: string;
  totalPostsRead: number;
  totalRepliesSent: number;
  estimatedCostUSD: number;
}

function load(): BotState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as BotState;
  } catch {
    return { totalPostsRead: 0, totalRepliesSent: 0, estimatedCostUSD: 0 };
  }
}

function save(state: BotState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2));
}

export function getSinceId(): string | undefined {
  return load().sinceId;
}

export function saveSinceId(sinceId: string) {
  const state = load();
  save({ ...state, sinceId });
}

// Track API usage for cost monitoring
// $0.005 per post read, $0.010 per reply sent
export function recordUsage(postsRead: number, repliesSent: number) {
  const state = load();
  const newCost = (postsRead * 0.005) + (repliesSent * 0.010);
  const updated = {
    ...state,
    totalPostsRead: state.totalPostsRead + postsRead,
    totalRepliesSent: state.totalRepliesSent + repliesSent,
    estimatedCostUSD: state.estimatedCostUSD + newCost,
  };
  save(updated);
  const threshold = parseFloat(process.env.COST_ALERT_THRESHOLD_USD || '50');
  if (updated.estimatedCostUSD > threshold) {
    console.warn(`[Bot] Warning: Estimated spend ~$${updated.estimatedCostUSD.toFixed(2)} USD. Check X Developer Console.`);
  }
}

export function getStats(): BotState {
  return load();
}
