'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAccounts, useConnect } from '@midl/react';
import { AddressPurpose } from '@midl/core';
import { useAddTxIntention, useSignIntention, useFinalizeBTCTransaction, useSendBTCTransactions } from '@midl/executor-react';
import { encodeFunctionData } from 'viem';
import { BONDING_CURVE_ABI, btcToWei } from '@/lib/contracts/config';

function detectPlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

function getXverseDeepLink(jobUrl: string): string {
  return `https://www.xverse.app/open?redirect=${encodeURIComponent(jobUrl)}`;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface BotJob {
  id: string;
  tweetId: string;
  xHandle: string;
  command: string;
  intentJson: string;
  status: string;
  launchAddress: string | null;
  tokenSymbol: string | null;
  amountSats: string | null;
  walletAddress: string | null;
  txHash: string | null;
  btcTxHash: string | null;
  errorMessage: string | null;
  expiresAt: string | null;
}

interface Intent {
  verb: string;
  tokenSymbol?: string;
  amountBtc?: number;
  launchAddress?: string;
  name?: string;
  ticker?: string;
  estimatedTokens?: number;
  minTokens?: number;
  currentPriceSats?: number;
}

interface LaunchData {
  curveAddress: string;
}

const STEPS = ['Signed & Broadcast', 'BTC Mempool', 'Midl Execution', 'Finalized'] as const;

export default function BotSignPage() {
  return (
    <Suspense fallback={<StatusCard title="Loading..." message="Fetching job details..." variant="neutral" />}>
      <BotSignPageInner />
    </Suspense>
  );
}

function BotSignPageInner() {
  const params = useParams<{ jobId: string }>();
  const searchParams = useSearchParams();
  const jobId = params.jobId;
  const fromX = searchParams.get('ref') === 'x';

  const { accounts } = useAccounts();
  const { connectors, connect } = useConnect({ purposes: [AddressPurpose.Payment] });
  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);

  const { addTxIntentionAsync } = useAddTxIntention();
  const { signIntentionAsync } = useSignIntention();
  const { finalizeBTCTransactionAsync } = useFinalizeBTCTransaction();
  const { sendBTCTransactionsAsync } = useSendBTCTransactions();

  const [job, setJob] = useState<BotJob | null>(null);
  const [launch, setLaunch] = useState<LaunchData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [executing, setExecuting] = useState(false);
  const [completedStep, setCompletedStep] = useState(-1);
  const [execError, setExecError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    fetch(`${API_URL}/api/bot/jobs/${jobId}`)
      .then(r => r.json())
      .then((data: { job?: BotJob; error?: string }) => {
        if (data.error) { setLoadError(data.error); return; }
        if (data.job) {
          setJob(data.job);
          // Fetch only curveAddress for the transaction — estimates come from intentJson
          const intent = (() => { try { return JSON.parse(data.job.intentJson) as Intent; } catch { return null; } })();
          if (intent?.launchAddress) {
            fetch(`${API_URL}/api/launches/${intent.launchAddress}`)
              .then(r => r.json())
              .then((l: LaunchData) => setLaunch(l))
              .catch(() => {});
          }
        }
      })
      .catch(() => setLoadError('Failed to load job'));
  }, [jobId]);

  if (loadError) {
    return <StatusCard title="Not Found" message={loadError} variant="error" />;
  }

  if (!job) {
    return <StatusCard title="Loading..." message="Fetching job details..." variant="neutral" />;
  }

  if (job.status === 'EXPIRED') {
    const expiredIntent = (() => { try { return JSON.parse(job.intentJson) as Intent; } catch { return null; } })();
    const expiredAmountBtc = expiredIntent?.amountBtc ?? (job.amountSats ? (Number(job.amountSats) / 1e8).toFixed(4) : '?');
    const expiredCommand = job.command === 'buy'
      ? `@midllaunchbot buy $${expiredIntent?.tokenSymbol ?? job.tokenSymbol} ${expiredAmountBtc} BTC`
      : `@midllaunchbot launch ${expiredIntent?.name ?? ''} ($${expiredIntent?.ticker ?? job.tokenSymbol})`;

    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div
          className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{
            background: 'var(--bg-glass)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            border: 'var(--glass-border)',
          }}
        >
          <div style={{ fontSize: 40 }}>⏱</div>
          <h1 className="font-display text-xl font-bold" style={{ color: 'var(--text-secondary)' }}>
            This request expired
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Bot sign requests expire after 10 minutes.
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Send this command on X to get a new link:
          </p>
          <code
            className="rounded-lg px-4 py-2 text-sm w-full text-center"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--orange-500)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              wordBreak: 'break-all',
            }}
          >
            {expiredCommand}
          </code>
          <a
            href="https://x.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary w-full text-center"
            style={{ textDecoration: 'none' }}
          >
            Open X →
          </a>
        </div>
      </main>
    );
  }

  if (job.status === 'CONFIRMED') {
    return <StatusCard title="Already Executed" message="This transaction was already executed." variant="success" />;
  }

  if (job.status === 'FAILED') {
    return <StatusCard title="Failed" message={job.errorMessage ?? 'Transaction failed.'} variant="error" />;
  }

  const intent = (() => { try { return JSON.parse(job.intentJson) as Intent; } catch { return null; } })();
  const amountBtc = intent?.amountBtc ?? (job.amountSats ? Number(job.amountSats) / 1e8 : 0);
  // Read estimates pre-calculated by the bot — no client-side recalculation needed
  const estimatedTokens = intent?.estimatedTokens ?? null;
  const minTokens = intent?.minTokens ?? null;

  const handleExecute = async () => {
    if (!paymentAccount) return;
    setExecuting(true);
    setExecError('');
    setCompletedStep(-1);

    try {
      // Mark job as EXECUTING
      await fetch(`${API_URL}/api/bot/jobs/${jobId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ btcAddress: paymentAccount.address }),
      });

      if (!launch?.curveAddress) throw new Error('Launch curve address not found');

      const minTokensOut = BigInt(0); // no slippage guard for bot-initiated trades

      const data = encodeFunctionData({
        abi: BONDING_CURVE_ABI,
        functionName: 'buy',
        args: ['0x0000000000000000000000000000000000000000000000000000000000000000', minTokensOut],
      });

      const intention = await addTxIntentionAsync({
        intention: {
          evmTransaction: {
            to: launch.curveAddress as `0x${string}`,
            data,
            value: btcToWei(amountBtc.toString()),
          },
        },
        from: paymentAccount.address,
        reset: true,
      });
      setCompletedStep(0);

      const fbtResult = await finalizeBTCTransactionAsync({ from: paymentAccount.address });
      setCompletedStep(1);

      const signedIntention = await signIntentionAsync({ txId: fbtResult.tx.id, intention });
      setCompletedStep(2);

      await sendBTCTransactionsAsync({
        serializedTransactions: [signedIntention],
        btcTransaction: fbtResult.tx.hex,
      });
      setCompletedStep(3);

      // Confirm job
      await fetch(`${API_URL}/api/bot/jobs/${jobId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          btcTxHash: fbtResult.tx.id,
          tokensReceived: estimatedTokens != null ? String(estimatedTokens) : undefined,
        }),
      });

      setDone(true);
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Transaction failed');
      await fetch(`${API_URL}/api/bot/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'Unknown error' }),
      }).catch(() => {});
    } finally {
      setExecuting(false);
    }
  };

  if (done) {
    return (
      <StatusCard
        title="Done"
        message="Check your X notifications — the bot will post your receipt once the transaction confirms."
        variant="success"
      />
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5"
        style={{
          background: 'var(--bg-glass)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          border: 'var(--glass-border)',
        }}
      >
        <h1 className="font-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          Sign to Execute
        </h1>

        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
        >
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--text-tertiary)' }}>Action</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {job.command === 'buy' ? `Buy $${job.tokenSymbol}` : `Launch $${job.tokenSymbol}`}
            </span>
          </div>
          {amountBtc > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>Amount</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                {amountBtc} BTC
              </span>
            </div>
          )}
          {estimatedTokens != null && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>Estimated</span>
              <span className="font-mono" style={{ color: 'var(--orange-500)' }}>
                ~{estimatedTokens.toLocaleString()} {job.tokenSymbol}
              </span>
            </div>
          )}
          {minTokens != null && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>Min (1% slip)</span>
              <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                {minTokens.toLocaleString()} {job.tokenSymbol}
              </span>
            </div>
          )}
          {paymentAccount && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>Wallet</span>
              <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                {paymentAccount.address.slice(0, 8)}...{paymentAccount.address.slice(-6)}
              </span>
            </div>
          )}
        </div>

        {/* Progress steps */}
        {executing && (
          <div className="flex flex-col gap-2">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-2 text-xs">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: i <= completedStep ? 'var(--green-500)' : i === completedStep + 1 ? 'var(--orange-500)' : 'var(--bg-elevated)',
                    border: i > completedStep + 1 ? '1px solid var(--bg-border)' : 'none',
                  }}
                >
                  {i <= completedStep && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
                <span style={{ color: i <= completedStep ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        )}

        {execError && (
          <p
            className="text-xs rounded-lg px-3 py-2"
            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red-500)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            {execError}
          </p>
        )}

        {!paymentAccount ? (
          <div className="flex flex-col gap-2">
            {fromX && detectPlatform() !== 'desktop' && (
              <a
                href={getXverseDeepLink(typeof window !== 'undefined' ? window.location.href : '')}
                className="btn btn-primary w-full text-center block"
                style={{ textDecoration: 'none' }}
              >
                Open in Xverse App →
              </a>
            )}
            <button
              onClick={() => connectors[0] && connect({ id: connectors[0].id })}
              className="btn btn-secondary w-full"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <button
            onClick={handleExecute}
            disabled={executing}
            className="btn btn-primary w-full text-base"
            style={{ padding: '14px' }}
          >
            {executing ? 'Signing...' : 'Sign & Execute'}
          </button>
        )}

        <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
          Non-custodial. Your keys stay in Xverse.
          {job.expiresAt && ` Expires ${new Date(job.expiresAt).toLocaleTimeString()}.`}
        </p>
      </div>
    </main>
  );
}

function StatusCard({ title, message, variant }: { title: string; message: string; variant: 'success' | 'error' | 'neutral' }) {
  const color = variant === 'success' ? 'var(--green-500)' : variant === 'error' ? 'var(--red-500)' : 'var(--text-tertiary)';
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
        style={{
          background: 'var(--bg-glass)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          border: 'var(--glass-border)',
        }}
      >
        <h1 className="font-display text-xl font-bold" style={{ color }}>
          {title}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {message}
        </p>
      </div>
    </main>
  );
}
