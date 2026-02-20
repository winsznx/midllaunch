# MIDLLAUNCH_BOT_ENHANCEMENTS.md
# Three targeted improvements to the bot. Build all three. No stubs.

---

## MANDATORY FIRST STEP

Use TodoWrite to create tasks ENH-001 through ENH-010 before writing any code.
Run `npx tsc --noEmit` in bot/ and backend/ after every 3 tasks. Fix errors before continuing.

---

## ENH-001 — Pre-validate token + pre-calculate estimate BEFORE creating job

In `bot/src/poller.ts`, the `processCommand` function currently creates a job and THEN
replies. Change the buy flow to do full validation and estimation first, so the
first reply already contains the token estimate.

Replace the buy command block with this logic:

```typescript
if (cmd.verb === 'buy') {
  // Step 1: Look up token
  const { launches } = await fetchJSON<{ launches: any[] }>(
    `${API()}/api/launches/search?q=${cmd.tokenSymbol}`
  );
  const launch = launches?.find((l: any) => l.symbol === cmd.tokenSymbol);

  if (!launch) {
    await reply(rwClient, tweetId, T.noToken(cmd.tokenSymbol));
    return;
  }

  // Step 2: Check graduation
  if (launch.status === 'FINALIZED' ||
      Number(launch.totalSupplySold) >= Number(launch.supplyCap)) {
    await reply(rwClient, tweetId, T.graduated(cmd.tokenSymbol));
    return;
  }

  // Step 3: Pre-calculate token estimate using linear bonding curve math
  // Price at current supply: basePrice + totalSupplySold * priceIncrement
  // For a given BTC amount, approximate tokens received:
  //   We solve: amountSats = tokens * (currentPrice + tokens/2 * priceIncrement)
  //   Simplified conservative estimate (slightly underestimates to avoid overpromising):
  const amountSats = Math.round(cmd.amountBtc * 1e8);
  const basePrice = Number(launch.basePrice || 1000);
  const priceIncrement = Number(launch.priceIncrement || 100);
  const currentSupply = Number(launch.totalSupplySold || 0);
  const currentPrice = basePrice + currentSupply * priceIncrement;
  // Conservative: use current price (not midpoint) so we never overpromise
  const estimatedTokens = Math.floor(amountSats / currentPrice);
  const minTokens = Math.floor(estimatedTokens * 0.99); // 1% slippage

  // Step 4: Create job with estimate baked in
  const { job } = await fetchJSON<{ job: any }>(`${API()}/api/bot/jobs`, {
    method: 'POST',
    body: JSON.stringify({
      tweetId, xHandle,
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
  await reply(
    rwClient,
    tweetId,
    T.buySign(cmd.tokenSymbol, cmd.amountBtc, estimatedTokens, minTokens, job.id)
  );

  await fetch(`${API()}/api/bot/jobs/${job.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'AWAITING_SIGNATURE', walletAddress: walletData.btcAddress }),
  }).catch(() => {});
  return;
}
```

---

## ENH-002 — Update `buySign` template to include estimate

In `bot/src/templates.ts`, update the `buySign` template signature and content:

```typescript
// REPLACE the existing buySign with this:
buySign: (symbol: string, btc: number, estimatedTokens: number, minTokens: number, jobId: string) =>
  `Buy ~${estimatedTokens.toLocaleString()} $${symbol} for ${btc} BTC\nMin guaranteed: ${minTokens.toLocaleString()} (1% slippage)\n\nSign here (10min): ${APP()}/bot/sign/${jobId}`,
```

Also update the sign page (`frontend/src/app/bot/sign/[jobId]/page.tsx`) to read
`estimatedTokens` and `minTokens` from `job.intentJson` and display them in the UI
instead of recalculating client-side. The bot already did the math — just show it.

---

## ENH-003 — Add `?ref=x` param + platform detection to sign page

In `frontend/src/app/bot/sign/[jobId]/page.tsx`, add platform detection logic
at the top of the component:

```typescript
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// Detect platform from user agent
function detectPlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

// Xverse deep link schemes
function getXverseDeepLink(jobUrl: string): string | null {
  const platform = detectPlatform();
  // Both iOS and Android: Xverse uses universal links, not custom schemes
  // Opening the URL directly is sufficient — Xverse registers as a handler for signing
  // We can add a "Open in Xverse" button for extra friction reduction
  if (platform === 'ios') {
    // iOS Universal Link — if Xverse is installed, it intercepts this
    return `https://www.xverse.app/open?redirect=${encodeURIComponent(jobUrl)}`;
  }
  if (platform === 'android') {
    return `https://www.xverse.app/open?redirect=${encodeURIComponent(jobUrl)}`;
  }
  return null;
}
```

In the sign page JSX, if platform is mobile AND Xverse is not already connected,
show an additional "Open in Xverse App" button above the standard "Connect Wallet" button:

```tsx
const platform = detectPlatform();
const searchParams = useSearchParams();
const fromX = searchParams.get('ref') === 'x'; // came from X bot reply

// Show above the connect button on mobile when arriving from X:
{fromX && platform !== 'desktop' && !isConnected && (
  <a
    href={getXverseDeepLink(window.location.href) ?? '#'}
    className="btn-primary w-full text-center mb-3"
    style={{ display: 'block' }}
  >
    Open in Xverse App →
  </a>
)}
```

Update `bot/src/templates.ts` to append `?ref=x` to all sign URLs:

```typescript
// In buySign, launchSign, and any other template with a sign URL:
// Change: ${APP()}/bot/sign/${jobId}
// To:     ${APP()}/bot/sign/${jobId}?ref=x
```

Find every template in `templates.ts` that contains `/bot/sign/` and append `?ref=x` to the URL.

---

## ENH-004 — Auto-reply on expired jobs

This is currently missing. When a job expires (status → EXPIRED) the user gets no
notification on X and has no idea why nothing happened.

Add an expiry notification watcher to `bot/src/jobs.ts`.

In the `startConfirmationWatcher` function, add a second interval that checks for
recently-expired jobs that haven't received an expiry reply:

```typescript
// Add this field to BotJob schema in backend/prisma/schema.prisma:
// expiryReplyTweetId  String?   -- tracks if we've sent the expiry notice

// Add to backend/src/api/index.ts:
app.get('/api/bot/jobs/recently-expired', async (req, res) => {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000); // last 15 min
  const jobs = await prisma.botJob.findMany({
    where: {
      status: 'EXPIRED',
      // @ts-ignore — add expiryReplyTweetId to schema first
      expiryReplyTweetId: null,
      updatedAt: { gt: cutoff },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
  res.json({ jobs });
});

app.post('/api/bot/jobs/:jobId/mark-expiry-replied', async (req, res) => {
  const { replyTweetId } = req.body;
  const job = await prisma.botJob.update({
    where: { id: req.params.jobId },
    // @ts-ignore
    data: { expiryReplyTweetId: replyTweetId },
  });
  res.json({ job });
});
```

Add `expiryReplyTweetId String?` to the `BotJob` model in `backend/prisma/schema.prisma`.
Run `npx prisma migrate dev --name "add-expiry-reply"`.

In `bot/src/jobs.ts`, add alongside the confirmation watcher:

```typescript
// Expiry notification watcher — runs every 30 seconds
const checkExpired = async () => {
  try {
    const res = await fetch(`${API()}/api/bot/jobs/recently-expired`);
    if (!res.ok) return;
    const { jobs } = await res.json() as { jobs: any[] };

    for (const job of jobs) {
      const text = T.expired(job.tokenSymbol || 'your token');
      if (!job.tweetId) continue;
      const replyId = await reply(rwClient, job.tweetId, text).catch(() => null);
      if (replyId) {
        await fetch(`${API()}/api/bot/jobs/${job.id}/mark-expiry-replied`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ replyTweetId: replyId }),
        });
      }
    }
  } catch (err: any) {
    console.error('[Jobs] Expiry watcher error:', err?.message);
  }
};

setInterval(checkExpired, 30_000);
```

---

## ENH-005 — Update `/bot/sign/[jobId]` page states for expiry

The sign page currently shows a generic "expired" message. Make it actionable:

When job status is `EXPIRED`, show:

```tsx
<div className="glass p-8 flex flex-col items-center gap-4 text-center">
  <div style={{ fontSize: 40 }}>⏱</div>
  <h3 className="font-display text-lg font-bold" style={{ color: 'var(--text-secondary)' }}>
    This request expired
  </h3>
  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
    Bot sign requests expire after 10 minutes.
  </p>
  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
    Send this command on X to get a new link:
  </p>
  {/* Reconstruct the original command from intentJson */}
  <code
    className="glass-sm px-4 py-2 text-sm w-full text-center"
    style={{ fontFamily: 'var(--font-mono)', color: 'var(--orange-500)' }}
  >
    @midllaunchbot buy ${intent.tokenSymbol} {(Number(job.amountSats) / 1e8).toFixed(4)} BTC
  </code>
  <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="btn-primary w-full text-center">
    Open X →
  </a>
</div>
```

Parse `intent` from `job.intentJson` using `JSON.parse`. Handle parse failures with a try/catch.

---

## ENH-006 — Add cost monitoring endpoint to backend

Add to `backend/src/api/index.ts`:

```typescript
app.get('/api/bot/stats', async (req, res) => {
  const totalJobs = await prisma.botJob.count();
  const confirmed = await prisma.botJob.count({ where: { status: 'CONFIRMED' } });
  const expired = await prisma.botJob.count({ where: { status: 'EXPIRED' } });
  const failed = await prisma.botJob.count({ where: { status: 'FAILED' } });
  const pending = await prisma.botJob.count({
    where: { status: { in: ['PENDING', 'AWAITING_SIGNATURE', 'EXECUTING'] } }
  });
  const linkedWallets = await prisma.xWalletLink.count();

  res.json({
    jobs: { total: totalJobs, confirmed, expired, failed, pending },
    linkedWallets,
    // Cost is tracked in bot-state.json on the bot service
    // Official tracking is in X Developer Console
  });
});
```

Show this on the `/bot-demo` page as a stats bar:
```
[Total Jobs: X]  [Confirmed: X]  [Linked Wallets: X]  [Expired: X]
```

---

## ENH-007 — Architecture pitch text for README

Add this section to `README.md` under the bot section:

```markdown
## Architecture — Why Non-Custodial Is Better

Most social trading bots are custodial: they hold your private keys and sign on your behalf.
MidlLaunchBot is different.

**The flow:**
1. You send a command on X
2. Bot creates a signing request and replies with a link
3. You tap the link — your Xverse wallet signs the actual Bitcoin PSBT
4. Bot posts the on-chain proof once confirmed

**Why this matters:**
- Your keys never leave your wallet
- The bot cannot move your funds without your signature
- Every transaction is verifiable on Bitcoin mempool + Midl Blockscout
- If the bot is compromised, no user funds are at risk

"We built non-custodial social trading on a Bitcoin L2.
The bot routes intent. The wallet signs. The chain proves."
```

---

## AFTER ALL TASKS — Verification checklist

1. `cd bot && npx tsc --noEmit` — zero errors
2. `cd backend && npx tsc --noEmit` — zero errors
3. `cd frontend && npm run build` — zero errors
4. In `/bot-demo`, test: `buy $ANYTOKEN 0.001 BTC`
   — verify the reply template now shows estimated token amount
   — verify the sign URL ends in `?ref=x`
5. Open the sign link from a mobile browser
   — verify "Open in Xverse App" button appears (platform detection working)
   — verify the estimated tokens and min tokens display correctly
6. Manually expire a job in Prisma Studio (set status=EXPIRED, expiryReplyTweetId=null)
   — restart bot service and verify expiry watcher fires within 30 seconds
7. Navigate to `/bot-demo` — verify stats bar shows job counts
8. Check `bot/bot-state.json` — verify it tracks cumulative estimated cost
```