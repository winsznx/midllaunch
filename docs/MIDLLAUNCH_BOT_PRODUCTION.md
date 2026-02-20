# MIDLLAUNCH_BOT_PRODUCTION.md
# X Bot — Full Production Build. Real On-Chain Transactions.
# Drop in project root. Give to agent with: "Read MIDLLAUNCH_BOT_PRODUCTION.md, create tasks BOT-001 through BOT-N using TodoWrite, execute in order, build without stubs."

---

## MANDATORY FIRST STEP

Use TodoWrite to create numbered tasks BOT-001 through BOT-N before writing any code.
After every 5 tasks: `npx tsc --noEmit` in the affected directory. Fix all errors before continuing.
Do not stop and ask what to do next. Execute the full list.

---

## X API FACTS — READ BEFORE TOUCHING ANY CODE

These are verified from the official docs (docs.x.com, February 2026):

**Pricing model**: Pay-per-use. Buy credits upfront at developer.x.com. No subscription.
**Reading a post**: $0.005 per post RETURNED. Empty polls cost $0.
**Creating a post (reply)**: $0.010 per post created.
**User lookup**: $0.010 per user returned.
**Only successful responses are billed.** A poll that returns 0 new mentions costs nothing.
**24-hour UTC deduplication**: Same post returned twice in one day = charged once.
**Monthly cap**: 2 million post reads on pay-per-use (enterprise for more).
**Rate limits still exist** (separate from cost): 450 requests per 15-minute window for mention timeline.
**Setup**: developer.x.com → create app → Keys and Tokens → OAuth 1.0a credentials.
**Library**: `twitter-api-v2` npm package (PLhery). Do not use twit, twitter, or raw axios.
**Authentication for bot**: OAuth 1.0a with 4 keys (appKey, appSecret, accessToken, accessSecret).
  These authenticate as the bot's own X account (the @midllaunchbot account itself).

**Cost math for your bot:**
- 60-second polling × 60min × 24h × 30d = 43,200 API calls/month
- If 99% return 0 posts (realistic for a new bot): ~432 posts read/month × $0.005 = $2.16
- 100 commands/month × $0.010 reply = $1.00
- Total at low volume: ~$3-5/month. Load $20 in credits, enable auto-recharge.

**Polling interval**: 60 seconds. Not 2 minutes, not 30 seconds. 60 seconds is safe at 1 request/min
= 15 requests per 15-minute window, well under the 450 limit.

---

## SIGNING ARCHITECTURE — CRITICAL, READ BEFORE BUILDING

Midl transactions require Xverse wallet PSBT signing. The bot cannot hold private keys.
The architecture is: **bot receives command → creates job → sends deep-link → user signs in one tap → tx executes → bot posts proof.**

This is NOT a limitation. It is a security feature. The pitch to judges:
"Non-custodial social trading — your keys never leave your wallet."

The deep-link sign page (`/bot/sign/[jobId]`) must use the exact same SDK flow as the regular buy page:
`addTxIntentionAsync → finalizeBTCTransactionAsync → signIntentionAsync → sendBTCTransactionsAsync`

The only difference from a regular buy: the page is accessed from a mobile browser after tapping a link
in X notifications. Design it mobile-first. The wallet connection and signing must work on mobile Safari
and Chrome. Test this.

---

## DIRECTORY STRUCTURE

Create `bot/` at the project root as a separate Node.js TypeScript service:

```
midllaunch/
  bot/
    src/
      index.ts         entry point
      poller.ts        X API mention polling (60s interval, since_id)
      parser.ts        strict regex command parser
      jobs.ts          job state machine + confirmation watcher
      replier.ts       posts X replies (dedup protection)
      templates.ts     all reply text (under 280 chars, no AI voice)
      state.ts         persists sinceId to bot-state.json
      costs.ts         tracks API spend for monitoring
    bot-state.json     auto-created, gitignored
    package.json
    tsconfig.json
    .env
    .env.example
```

---

## BOT-001 — Create `bot/package.json`

```json
{
  "name": "midllaunch-bot",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "twitter-api-v2": "^1.17.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "@types/node": "^20.11.0"
  }
}
```

Run `cd bot && npm install` after creating this file.

---

## BOT-002 — Create `bot/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## BOT-003 — Create `bot/.env.example`

```bash
# ─── X API Credentials ────────────────────────────────────────────────────────
# Get from: developer.x.com → Your Project → Your App → Keys and Tokens
# Requires pay-per-use credits in Developer Console (start with $20)
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=

# ─── Bot Identity ──────────────────────────────────────────────────────────────
# The X @username of the bot account (without @)
BOT_USERNAME=midllaunchbot

# ─── MidlLaunch Services ──────────────────────────────────────────────────────
MIDLLAUNCH_API_URL=http://localhost:4000
MIDLLAUNCH_APP_URL=http://localhost:3002

# ─── Polling ──────────────────────────────────────────────────────────────────
# 60000 = 60 seconds. Do not go below 30000 (30s) to avoid rate limit issues.
POLL_INTERVAL_MS=60000

# ─── Safety ───────────────────────────────────────────────────────────────────
# Max BTC per single bot command (safety cap, cannot be overridden by user)
MAX_TRADE_BTC=0.1

# ─── X API Cost Monitoring ────────────────────────────────────────────────────
# Rough tracking only — official tracking is in X Developer Console
# Alert in logs when estimated monthly spend exceeds this (USD)
COST_ALERT_THRESHOLD_USD=50
```

Copy `.env.example` to `.env` and fill in real values. Add `bot/.env` to `.gitignore`.

---

## BOT-004 — Add BotJob and XWalletLink to backend Prisma schema

In `backend/prisma/schema.prisma`, add:

```prisma
model BotJob {
  id              String    @id @default(cuid())
  tweetId         String    @unique
  xHandle         String
  command         String    // "buy" | "sell" | "launch" | "portfolio" | "help" | "link"
  intentJson      String    @db.Text
  status          String    @default("PENDING")
  // States: PENDING → AWAITING_SIGNATURE → EXECUTING → CONFIRMED → FAILED → EXPIRED
  launchAddress   String?
  tokenSymbol     String?
  amountSats      BigInt?
  walletAddress   String?
  txHash          String?
  btcTxHash       String?
  replyTweetId    String?
  errorMessage    String?
  expiresAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model XWalletLink {
  id            String   @id @default(cuid())
  xHandle       String   @unique
  btcAddress    String
  evmAddress    String?
  signedMessage String
  linkedAt      DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

Run: `cd backend && npx prisma migrate dev --name "add-bot-models"`

---

## BOT-005 — Add all bot API endpoints to `backend/src/api/index.ts`

Add these 10 endpoints. Wire them to real Prisma queries. No stubs.

```typescript
// ─── 1. Link X handle to wallet ────────────────────────────────────────────
app.post('/api/bot/link-wallet', async (req, res) => {
  const { xHandle, btcAddress, evmAddress, signedMessage } = req.body;
  if (!xHandle || !btcAddress || !signedMessage)
    return res.status(400).json({ error: 'xHandle, btcAddress, signedMessage required' });
  const clean = xHandle.toLowerCase().replace('@', '');
  const link = await prisma.xWalletLink.upsert({
    where: { xHandle: clean },
    create: { xHandle: clean, btcAddress, evmAddress, signedMessage },
    update: { btcAddress, evmAddress, signedMessage },
  });
  res.json({ link });
});

// ─── 2. Get wallet for an X handle ────────────────────────────────────────
app.get('/api/bot/wallet/:xHandle', async (req, res) => {
  const handle = req.params.xHandle.toLowerCase().replace('@', '');
  const link = await prisma.xWalletLink.findUnique({ where: { xHandle: handle } });
  if (!link) return res.status(404).json({ error: 'no_wallet_linked' });
  res.json({ btcAddress: link.btcAddress, evmAddress: link.evmAddress });
});

// ─── 3. Create a bot job (idempotent by tweetId) ────────────────────────────
app.post('/api/bot/jobs', async (req, res) => {
  const { tweetId, xHandle, command, intentJson, launchAddress, tokenSymbol, amountSats } = req.body;
  if (!tweetId || !xHandle || !command || !intentJson)
    return res.status(400).json({ error: 'tweetId, xHandle, command, intentJson required' });
  const existing = await prisma.botJob.findUnique({ where: { tweetId } });
  if (existing) return res.json({ job: existing, duplicate: true });
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  const job = await prisma.botJob.create({
    data: {
      tweetId,
      xHandle: xHandle.toLowerCase().replace('@', ''),
      command,
      intentJson: typeof intentJson === 'string' ? intentJson : JSON.stringify(intentJson),
      launchAddress: launchAddress || null,
      tokenSymbol: tokenSymbol || null,
      amountSats: amountSats ? BigInt(amountSats) : null,
      expiresAt,
    },
  });
  res.json({ job });
});

// ─── 4. Get a single job (used by sign page) ────────────────────────────────
app.get('/api/bot/jobs/:jobId', async (req, res) => {
  const job = await prisma.botJob.findUnique({ where: { id: req.params.jobId } });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ job });
});

// ─── 5. Update job status and wallet (called by bot poller + sign page) ────
app.patch('/api/bot/jobs/:jobId', async (req, res) => {
  const { status, walletAddress, errorMessage } = req.body;
  const job = await prisma.botJob.update({
    where: { id: req.params.jobId },
    data: {
      ...(status && { status }),
      ...(walletAddress && { walletAddress }),
      ...(errorMessage && { errorMessage }),
    },
  });
  res.json({ job });
});

// ─── 6. Frontend calls this after user signs + submits tx ──────────────────
app.post('/api/bot/jobs/:jobId/execute', async (req, res) => {
  const { btcAddress } = req.body;
  const job = await prisma.botJob.findUnique({ where: { id: req.params.jobId } });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!['PENDING', 'AWAITING_SIGNATURE'].includes(job.status))
    return res.status(400).json({ error: `Job status is ${job.status}` });
  if (job.expiresAt && job.expiresAt < new Date()) {
    await prisma.botJob.update({ where: { id: job.id }, data: { status: 'EXPIRED' } });
    return res.status(410).json({ error: 'Job expired. Send command again on X.' });
  }
  const updated = await prisma.botJob.update({
    where: { id: job.id },
    data: { status: 'EXECUTING', walletAddress: btcAddress },
  });
  res.json({ job: updated });
});

// ─── 7. Frontend calls this after tx confirms on-chain ────────────────────
app.post('/api/bot/jobs/:jobId/confirm', async (req, res) => {
  const { txHash, btcTxHash, tokensReceived } = req.body;
  const job = await prisma.botJob.update({
    where: { id: req.params.jobId },
    data: {
      status: 'CONFIRMED',
      txHash: txHash || null,
      btcTxHash: btcTxHash || null,
      ...(tokensReceived && {
        intentJson: (() => {
          try {
            const parsed = JSON.parse(job.intentJson || '{}');
            return JSON.stringify({ ...parsed, tokensReceived });
          } catch { return job.intentJson; }
        })()
      }),
    },
  });
  // Publish to Redis so confirmation watcher in bot service detects it
  try {
    await publisher.publish('bot_updates', JSON.stringify({
      type: 'job_confirmed',
      jobId: job.id,
      tweetId: job.tweetId,
      xHandle: job.xHandle,
      command: job.command,
      tokenSymbol: job.tokenSymbol,
      amountSats: job.amountSats?.toString(),
      txHash,
      btcTxHash,
      tokensReceived,
      launchAddress: job.launchAddress,
    }));
  } catch { /* Redis optional — bot polls as fallback */ }
  res.json({ job });
});

// ─── 8. Bot polls this to find confirmed jobs that need replies ────────────
app.get('/api/bot/jobs/recently-confirmed', async (req, res) => {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000); // last 10 min
  const jobs = await prisma.botJob.findMany({
    where: { status: 'CONFIRMED', replyTweetId: null, updatedAt: { gt: cutoff } },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
  res.json({ jobs });
});

// ─── 9. Mark a job as replied (bot calls this after posting X reply) ────────
app.post('/api/bot/jobs/:jobId/mark-replied', async (req, res) => {
  const { replyTweetId } = req.body;
  const job = await prisma.botJob.update({
    where: { id: req.params.jobId },
    data: { replyTweetId },
  });
  res.json({ job });
});

// ─── 10. Expire old jobs (bot calls at start of each poll) ────────────────
app.post('/api/bot/jobs/expire-old', async (req, res) => {
  const result = await prisma.botJob.updateMany({
    where: {
      status: { in: ['PENDING', 'AWAITING_SIGNATURE'] },
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });
  res.json({ expired: result.count });
});
```

After adding all endpoints: `cd backend && npx tsc --noEmit` — fix all errors.

---

## BOT-006 — Create `bot/src/state.ts`

```typescript
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
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
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
    console.warn(`[Bot] ⚠️  Estimated spend ~$${updated.estimatedCostUSD.toFixed(2)} USD. Check X Developer Console.`);
  }
}

export function getStats(): BotState {
  return load();
}
```

---

## BOT-007 — Create `bot/src/parser.ts`

```typescript
// Strict regex parsing only. No NLP. No ambiguity.
// If a command doesn't exactly match a pattern, it returns null → silently ignored.

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
    if ((unit === 'sats' || unit === 'sat')) amountBtc = amountBtc / 1e8;
    if (!isFinite(amountBtc) || amountBtc <= 0) return null;
    const max = parseFloat(process.env.MAX_TRADE_BTC || '0.1');
    if (amountBtc > max) return null; // safety cap
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
  '@midllaunchbot link    ← connects your wallet to your X handle',
];
```

---

## BOT-008 — Create `bot/src/templates.ts`

Every reply is under 280 characters. No em dashes used decoratively. No exclamation marks. No AI voice.

```typescript
import { COMMAND_DOCS } from './parser';

const APP = () => process.env.MIDLLAUNCH_APP_URL || 'https://midllaunch.xyz';

export const T = {
  // Sent immediately on valid buy command — user needs to click and sign
  buySign: (symbol: string, btc: number, jobId: string) =>
    `Sign to buy $${symbol} with ${btc} BTC (expires 10min):\n${APP()}/bot/sign/${jobId}\n\nYour Xverse wallet. Your keys. Non-custodial.`,

  // Sent when buy tx confirms on-chain
  buyDone: (symbol: string, tokens: string, btc: number, launchAddr: string, evmTx: string) =>
    `Bought ${tokens} $${symbol} for ${btc} BTC\n\nTrade: ${APP()}/launch/${launchAddr}\nProof: blockscout.staging.midl.xyz/tx/${evmTx.slice(0,16)}...`,

  // No wallet linked
  noWallet: () =>
    `No wallet linked to your X handle.\n\nLink it (30 sec): ${APP()}/link-x\n\nThen retry your command.`,

  // Launch sign
  launchSign: (name: string, ticker: string, jobId: string) =>
    `Deploy $${ticker} (${name}) — sign here (expires 10min):\n${APP()}/bot/sign/${jobId}`,

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

  // Bad command syntax
  badSyntax: () =>
    `Not recognized. Try:\n@midllaunchbot buy $TOKEN 0.001 BTC\n@midllaunchbot help`,
};
```

---

## BOT-009 — Create `bot/src/replier.ts`

```typescript
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
  } catch (err: any) {
    if (err?.code === 429) {
      console.error('[Replier] Rate limited on reply — propagating');
      throw err;
    }
    if (err?.code === 403) {
      console.error(`[Replier] 403 on reply — check app write permissions in developer.x.com`);
      return null;
    }
    console.error(`[Replier] Failed to reply to ${tweetId}:`, err?.message);
    return null;
  }
}
```

---

## BOT-010 — Create `bot/src/poller.ts`

```typescript
import { TwitterApi } from 'twitter-api-v2';
import { getSinceId, saveSinceId, recordUsage } from './state';
import { parseCommand } from './parser';
import { reply } from './replier';
import { T } from './templates';

const API = () => process.env.MIDLLAUNCH_API_URL!;
const APP = () => process.env.MIDLLAUNCH_APP_URL!;

async function fetchJSON<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(`${opts?.method || 'GET'} ${url} → ${res.status}`);
  return res.json();
}

export async function runPollCycle(rwClient: any, botUserId: string) {
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

  // The mentions endpoint: GET /2/users/:id/mentions
  // Cost: $0.005 per post RETURNED. If 0 new mentions → $0.
  const mentions = await rwClient.v2.userMentionTimeline(botUserId, params);

  const tweets = mentions.data?.data;
  if (!tweets?.length) return; // no new mentions — nothing to do

  // Update sinceId to newest tweet (Twitter returns newest first)
  saveSinceId(tweets[0].id);
  recordUsage(tweets.length, 0); // track cost

  // Build userId → username map from expansions
  const userMap = new Map<string, string>();
  for (const user of mentions.data?.includes?.users ?? []) {
    userMap.set(user.id, user.username);
  }

  // Process in chronological order (oldest first)
  for (const tweet of [...tweets].reverse()) {
    // Skip bot's own tweets (can happen if someone quotes a bot reply)
    if (tweet.author_id === botUserId) continue;

    const xHandle = userMap.get(tweet.author_id ?? '') ?? 'unknown';
    console.log(`[Poller] @${xHandle}: "${tweet.text}"`);

    const command = parseCommand(tweet.text);
    if (!command) {
      // Only reply if it looks intentional (more than 2 words after the mention)
      const cleanedText = tweet.text.replace(/@midllaunchbot/gi, '').trim();
      if (cleanedText.split(' ').length >= 2) {
        await reply(rwClient, tweet.id, T.badSyntax()).catch(() => {});
      }
      continue;
    }

    await processCommand(rwClient, tweet.id, xHandle, command);
  }
}

async function processCommand(rwClient: any, tweetId: string, xHandle: string, cmd: any) {
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
      const { holdings } = await fetchJSON<{ holdings: any[] }>(
        `${API()}/api/user/${walletData.btcAddress}/holdings`
      );
      if (!holdings?.length) {
        await reply(rwClient, tweetId, T.portfolioEmpty(xHandle));
        return;
      }
      const lines = holdings.slice(0, 3).map((h: any) => `${h.totalTokens} $${h.symbol}`).join('\n');
      const totalBtc = holdings.reduce((s: number, h: any) => s + (Number(h.amountSats || 0) / 1e8), 0).toFixed(6);
      await reply(rwClient, tweetId, T.portfolio(xHandle, totalBtc, lines));
      return;
    }

    if (cmd.verb === 'buy') {
      // Look up token by symbol
      const { launches } = await fetchJSON<{ launches: any[] }>(
        `${API()}/api/launches/search?q=${cmd.tokenSymbol}`
      );
      const launch = launches?.find((l: any) => l.symbol === cmd.tokenSymbol);

      if (!launch) {
        await reply(rwClient, tweetId, T.noToken(cmd.tokenSymbol));
        return;
      }

      // Check if graduated
      if (launch.status === 'FINALIZED' || launch.totalSupplySold >= launch.supplyCap) {
        await reply(rwClient, tweetId, T.graduated(cmd.tokenSymbol));
        return;
      }

      // Create job
      const amountSats = Math.round(cmd.amountBtc * 1e8);
      const { job } = await fetchJSON<{ job: any }>(`${API()}/api/bot/jobs`, {
        method: 'POST',
        body: JSON.stringify({
          tweetId,
          xHandle,
          command: 'buy',
          intentJson: { verb: 'buy', tokenSymbol: cmd.tokenSymbol, amountBtc: cmd.amountBtc, launchAddress: launch.tokenAddress },
          launchAddress: launch.tokenAddress,
          tokenSymbol: cmd.tokenSymbol,
          amountSats,
        }),
      });

      const replyId = await reply(rwClient, tweetId, T.buySign(cmd.tokenSymbol, cmd.amountBtc, job.id));

      // Update job to AWAITING_SIGNATURE
      await fetch(`${API()}/api/bot/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'AWAITING_SIGNATURE', walletAddress: walletData.btcAddress }),
      }).catch(() => {});
      return;
    }

    if (cmd.verb === 'launch') {
      const { job } = await fetchJSON<{ job: any }>(`${API()}/api/bot/jobs`, {
        method: 'POST',
        body: JSON.stringify({
          tweetId, xHandle,
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

  } catch (err: any) {
    console.error(`[Poller] Error processing @${xHandle} command:`, err?.message);
  }
}
```

---

## BOT-011 — Create `bot/src/jobs.ts` — confirmation watcher

```typescript
// Polls for CONFIRMED jobs every 10 seconds and posts the final X reply with proof.
// This is the "transaction confirmed" → "bot posts receipt" leg of the flow.

import { TwitterApiReadWrite } from 'twitter-api-v2';
import { reply } from './replier';
import { T } from './templates';

const API = () => process.env.MIDLLAUNCH_API_URL!;

export function startConfirmationWatcher(rwClient: TwitterApiReadWrite) {
  const check = async () => {
    try {
      const res = await fetch(`${API()}/api/bot/jobs/recently-confirmed`);
      if (!res.ok) return;
      const { jobs } = await res.json() as { jobs: any[] };

      for (const job of jobs) {
        if (job.replyTweetId) continue; // already replied

        let text = '';
        const intent = (() => { try { return JSON.parse(job.intentJson); } catch { return {}; } })();

        if (job.command === 'buy' && job.txHash) {
          const tokens = intent.tokensReceived
            ? Number(intent.tokensReceived).toLocaleString()
            : '?';
          const btc = job.amountSats ? (Number(job.amountSats) / 1e8) : 0;
          text = T.buyDone(job.tokenSymbol, tokens, btc, job.launchAddress || '', job.txHash);
        }

        if (job.command === 'launch' && job.launchAddress) {
          text = T.launchDone(intent.name || job.tokenSymbol, job.tokenSymbol, job.launchAddress);
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
    } catch (err: any) {
      console.error('[Jobs] Confirmation watcher error:', err?.message);
    }
  };

  setInterval(check, 10_000);
  console.log('[Jobs] Confirmation watcher started');
}
```

---

## BOT-012 — Create `bot/src/index.ts` — entry point

```typescript
import 'dotenv/config';
import { TwitterApi } from 'twitter-api-v2';
import { runPollCycle } from './poller';
import { startConfirmationWatcher } from './jobs';
import { getStats } from './state';

const REQUIRED_ENV = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET', 'MIDLLAUNCH_API_URL'];

async function main() {
  // Validate env
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('[Bot] Missing required environment variables:', missing.join(', '));
    console.error('[Bot] Copy bot/.env.example to bot/.env and fill in X API credentials.');
    console.error('[Bot] Get credentials at: developer.x.com → Your App → Keys and Tokens');
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
    console.error('[Bot] X API authentication failed:', err?.message);
    console.error('[Bot] Check your credentials at developer.x.com');
    process.exit(1);
  });

  const botUserId = me.data.id;
  console.log(`[Bot] Authenticated as @${me.data.username} (ID: ${botUserId})`);

  const stats = getStats();
  console.log(`[Bot] Estimated cumulative spend: ~$${stats.estimatedCostUSD.toFixed(2)} USD`);
  console.log(`[Bot] Posts read: ${stats.totalPostsRead} | Replies sent: ${stats.totalRepliesSent}`);

  // Start confirmation watcher (posts X receipts after txns confirm)
  startConfirmationWatcher(client.readWrite);

  // Initial poll immediately
  const poll = async () => {
    try {
      await runPollCycle(client.readWrite, botUserId);
    } catch (err: any) {
      if (err?.code === 429) {
        const retryAfter = (err?.rateLimit?.reset
          ? Math.ceil((err.rateLimit.reset * 1000 - Date.now()) / 1000)
          : 300);
        console.warn(`[Bot] Rate limited. Retrying in ${retryAfter}s`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
      } else {
        console.error('[Bot] Poll error:', err?.message);
      }
    }
  };

  await poll();

  const interval = parseInt(process.env.POLL_INTERVAL_MS || '60000');
  setInterval(poll, interval);
  console.log(`[Bot] Polling every ${interval / 1000}s`);
}

main();
```

---

## BOT-013 — Frontend: `/link-x` page

Create `frontend/src/app/link-x/page.tsx`.

This is where users permanently link their X @handle to their Xverse wallet.
They do this once. After that, all bot commands use their linked wallet.

Implementation:
1. Text input for X @handle (auto-strips @, lowercases)
2. Wallet connection via existing `useConnect()` hook
3. Sign message with `useSignMessage` from wagmi:
   ```typescript
   const message = `Link @${handle} to MidlLaunch | ${btcAddress} | ${new Date().toISOString().slice(0,10)}`;
   ```
4. On success, POST to `/api/bot/link-wallet`
5. Show green success card: "Wallet linked. You can now use @midllaunchbot on X."
6. If already linked, show the linked wallet with option to update

Style: centered single glass card, mobile-first (most users will do this on their phone after seeing the bot reply).

---

## BOT-014 — Frontend: `/bot/sign/[jobId]` page

Create `frontend/src/app/bot/sign/[jobId]/page.tsx`.

This is the deep-link page sent in the bot's first reply. User taps it on X notifications.

Critical: this page must work on mobile. Test on real mobile Safari.

Implementation:
1. Fetch job: `GET /api/bot/jobs/[jobId]`
2. Handle each job state:
   - `EXPIRED`: show "This request expired. Send the command again on X."
   - `CONFIRMED`: show "Transaction already executed. View on explorer."
   - `FAILED`: show the error message
   - `AWAITING_SIGNATURE` or `PENDING`: show the sign UI

3. Sign UI (glass card, centered):
   ```
   Sign to Execute
   ───────────────────────
   [Token icon or gradient]

   Buy $PEPBTC
   Amount: 0.001 BTC

   You'll receive: ~1,240 PEPBTC (estimated)
   Slippage tolerance: 1%
   Min received: ~1,227 PEPBTC

   Wallet: bc1q...a3f4

   [Connect Wallet]    (if not connected)
   or
   [Sign & Execute]    (if connected — large orange button)
   ```

4. When user taps "Sign & Execute":
   - POST `/api/bot/jobs/[jobId]/execute` with btcAddress
   - Run the full SDK buy flow using the existing BuyPanel logic (extract or import it)
   - Show the transaction lifecycle component (Signed → BTC Mempool → Midl Executed → Finalized)
   - On confirmation: POST `/api/bot/jobs/[jobId]/confirm` with txHash + btcTxHash + tokensReceived
   - Show: "Done. Check your X notifications — the bot will post your receipt."

5. The estimated token calculation:
   ```typescript
   // Linear bonding curve math (no contract call needed for estimate)
   const currentPrice = launch.basePrice + (launch.totalSupplySold * launch.priceIncrement);
   const avgPrice = currentPrice + (amountSats / 2 * launch.priceIncrement); // midpoint
   const estimatedTokens = Math.floor(amountSats / avgPrice);
   ```
   This is an estimate. The contract gets the exact amount. Show it with "~" prefix.

---

## BOT-015 — Update Header navigation

In `frontend/src/components/layout/Header.tsx`:

Add "🤖 Bot" nav link pointing to `/bot-demo` on desktop.
On mobile menu (MobileMenu.tsx), add "Bot Demo" link.

Also add "Link Wallet" to the wallet dropdown (when user is connected):
- Show "Link to X" option that navigates to `/link-x`
- If already linked, show "Linked to @handle" with green dot

---

## BOT-016 — Frontend: `/bot-demo` demo page

Create `frontend/src/app/bot-demo/page.tsx`.

This page lets judges (and users) simulate the full X bot flow without needing an X account.

Layout: two panels side by side (stack on mobile)

**Left panel — "X Simulator":**
- Looks like a minimal X thread
- Shows mock tweets from "@demouser" and "@midllaunchbot"
- New entries appear at top with the `activity-item-new` slide animation

**Right panel — "Test a Command":**
- Text input pre-filled with: `buy $PEPBTC 0.001 BTC`
- "Send Command" button (orange)
- Below button: link to `/link-x` ("Link your wallet first")

When user clicks "Send Command":
1. Parse the command client-side using the same regex patterns from `parser.ts` (port them to a frontend util)
2. POST to `/api/bot/jobs` directly (simulating what the poller would do)
3. Add the user's command as a "tweet" in the left panel
4. Show the bot's reply (sign link) appearing below it
5. The sign link goes to the real `/bot/sign/[jobId]` — it's a real job that can actually be executed

Banner at top: "DEMO MODE — In production, commands come from mentions of @midllaunchbot on X. Get started at developer.x.com"

---

## BOT-017 — Update root and README

Add to `package.json` at project root (create if missing):
```json
{
  "scripts": {
    "bot": "cd bot && npm install && npm run dev",
    "start:all": "concurrently \"cd backend && npm run api\" \"cd backend && npm run indexer\" \"cd frontend && npm run dev\" \"npm run bot\""
  }
}
```

Update `README.md`:
```markdown
## Running MidlLaunchBot

### Prerequisites
1. Sign up at developer.x.com
2. Create a project and app
3. Generate OAuth 1.0a keys (API Key, API Secret, Access Token, Access Token Secret)
4. Purchase X API credits ($20 is enough to start — pay-per-use, no subscription)
5. Enable auto-recharge at $5 threshold in Developer Console to avoid interruption

### Setup
cp bot/.env.example bot/.env
# Fill in X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET

### Run
npm run bot

### Cost estimate
At 100 commands/month:
- 100 posts read × $0.005 = $0.50
- 100 replies × $0.010 = $1.00
- Total: ~$1.50/month

### Supported commands (tag @midllaunchbot)
@midllaunchbot buy $TOKEN 0.001 BTC
@midllaunchbot buy $TOKEN 100000 sats
@midllaunchbot sell $TOKEN 50%
@midllaunchbot sell $TOKEN all
@midllaunchbot launch MyToken ($MYT)
@midllaunchbot portfolio
@midllaunchbot link
@midllaunchbot help
```

---

## FINAL VERIFICATION CHECKLIST

After completing all tasks:

1. `cd bot && npx tsc --noEmit` — zero errors
2. `cd backend && npx tsc --noEmit` — zero errors
3. `cd frontend && npm run build` — zero errors
4. Start all services and navigate to `/bot-demo`
5. Type `buy $TESTTOKEN 0.001 BTC` → verify job created in DB
6. Click the sign link → verify it loads the correct job details
7. Navigate to `/link-x` → verify wallet linking form works
8. Navigate to `/transactions` → verify bot-executed jobs will appear
9. In `bot/.env`, verify all 4 X API credentials are filled
10. Verify `bot-state.json` is in `.gitignore`

---

## COMPLETE LIFECYCLE (end to end)

```
User on X:
  @midllaunchbot buy $PEPBTC 0.001 BTC
         ↓
Bot poller detects mention (60s poll, $0.005)
         ↓
parser.ts: parses → { verb: 'buy', tokenSymbol: 'PEPBTC', amountBtc: 0.001 }
         ↓
Backend: search token, verify not graduated, check user wallet linked
         ↓
Backend: create BotJob { status: 'AWAITING_SIGNATURE', expiresAt: +10min }
         ↓
Bot replies on X ($0.010):
  "Sign to buy $PEPBTC with 0.001 BTC:
   midllaunch.xyz/bot/sign/abc123 (expires 10min)"
         ↓
User taps link on phone (X notification → browser)
         ↓
/bot/sign/[jobId] page loads — shows job details
         ↓
User connects Xverse wallet (or already connected)
         ↓
User taps "Sign & Execute"
         ↓
Frontend SDK: addTxIntentionAsync → finalizeBTCTransactionAsync
           → signIntentionAsync → sendBTCTransactionsAsync
         ↓
POST /api/bot/jobs/[jobId]/execute { btcAddress }
         ↓
BTC transaction enters mempool
         ↓
Midl execution layer processes it
         ↓
POST /api/bot/jobs/[jobId]/confirm { txHash, btcTxHash, tokensReceived }
         ↓
Job status → CONFIRMED
Redis publishes 'bot_updates' event
         ↓
Bot confirmation watcher detects CONFIRMED job (10s poll)
         ↓
Bot replies on X ($0.010):
  "Bought 1,240 $PEPBTC for 0.001 BTC
   Trade: midllaunch.xyz/launch/0x...
   Proof: blockscout.staging.midl.xyz/tx/0xabc..."
         ↓
Job marked replyTweetId = set. Done.
```

Total X API cost per completed trade: $0.005 (read) + $0.010 (first reply) + $0.010 (confirmation reply) = **$0.025 per trade executed**.
