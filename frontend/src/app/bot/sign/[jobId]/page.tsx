'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAccounts, useConnect } from '@midl/react';
import { AddressPurpose } from '@midl/core';
import { useAddTxIntention, useSignIntention, useFinalizeBTCTransaction, useSendBTCTransactions } from '@midl/executor-react';
import { encodeFunctionData } from 'viem';
import { BONDING_CURVE_ABI, LAUNCH_FACTORY_ABI, LAUNCH_FACTORY_ADDRESS, btcToWei } from '@/lib/contracts/config';
import { TxProgress, TxStep } from '@/components/ui/TxProgress';

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

interface BuyIntent {
  verb: 'buy';
  tokenSymbol?: string;
  amountBtc?: number;
  launchAddress?: string;
  estimatedTokens?: number;
  minTokens?: number;
  currentPriceSats?: number;
}

interface SellIntent {
  verb: 'sell';
  tokenSymbol?: string;
  curveAddress: string;
  tokenAmountBaseUnits: string;
  expectedBtcSats: string;
  minBtcSats: string;
}

interface LaunchIntent {
  verb: 'launch';
  name?: string;
  ticker?: string;
  supplyCap?: string;
  basePrice?: string;
  priceIncrement?: string;
  creatorFeeRate?: string;
  mode?: number;
  modeMetadata?: `0x${string}`;
}

type Intent = BuyIntent | SellIntent | LaunchIntent;

interface LaunchData {
  curveAddress: string;
}

function makeBotSteps(activeStep: number, btcTxId?: string): TxStep[] {
  const labels: { label: string; detail?: string }[] = [
    { label: 'Queue EVM intent' },
    { label: 'Build BTC transaction', detail: btcTxId ? `${btcTxId.slice(0, 16)}…` : undefined },
    { label: 'Sign with wallet (BIP-322)' },
    { label: 'Broadcast to Midl' },
  ];
  return labels.map((s, i) => ({
    label: s.label,
    detail: s.detail,
    status: i < activeStep ? 'done' : i === activeStep ? 'active' : 'pending',
  }));
}

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
  const [activeStep, setActiveStep] = useState(0);
  const [btcTxId, setBtcTxId] = useState<string | undefined>();
  const [execError, setExecError] = useState('');
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    fetch(`${API_URL}/api/bot/jobs/${jobId}`)
      .then(r => r.json())
      .then((data: { job?: BotJob; error?: string }) => {
        if (data.error) { setLoadError(data.error); return; }
        if (data.job) {
          setJob(data.job);
          // For buy commands: fetch curveAddress from the launch — estimates come from intentJson
          // For sell commands: curveAddress is embedded in the intent, no fetch needed
          const intent = (() => { try { return JSON.parse(data.job.intentJson) as Intent; } catch { return null; } })();
          if (data.job.command === 'buy' && intent && 'launchAddress' in intent && intent.launchAddress) {
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
    let expiredCommand = '';
    if (job.command === 'buy') {
      const amountBtc = (expiredIntent as BuyIntent | null)?.amountBtc ?? (job.amountSats ? (Number(job.amountSats) / 1e8).toFixed(4) : '?');
      expiredCommand = `@midllaunchbot buy $${job.tokenSymbol} ${amountBtc} BTC`;
    } else if (job.command === 'sell') {
      expiredCommand = `@midllaunchbot sell $${job.tokenSymbol} <amount>%`;
    } else {
      const li = expiredIntent as LaunchIntent | null;
      expiredCommand = `@midllaunchbot launch ${li?.name ?? ''} ($${li?.ticker ?? job.tokenSymbol})`;
    }

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
  const isSell = job.command === 'sell';
  const sellIntent = isSell ? (intent as SellIntent | null) : null;
  const buyIntent = !isSell && job.command === 'buy' ? (intent as BuyIntent | null) : null;

  const amountBtc = buyIntent?.amountBtc ?? (job.amountSats ? Number(job.amountSats) / 1e8 : 0);
  const estimatedTokens = buyIntent?.estimatedTokens ?? null;
  const minTokens = buyIntent?.minTokens ?? null;
  const TOKEN_UNIT = BigInt('1000000000000000000');
  const sellTokenDisplay = sellIntent?.tokenAmountBaseUnits
    ? Number(BigInt(sellIntent.tokenAmountBaseUnits) / TOKEN_UNIT).toLocaleString()
    : null;
  const sellExpectedBtc = sellIntent?.expectedBtcSats
    ? (Number(sellIntent.expectedBtcSats) / 1e8).toFixed(6)
    : null;
  const sellMinBtc = sellIntent?.minBtcSats
    ? (Number(sellIntent.minBtcSats) / 1e8).toFixed(6)
    : null;

  const handleExecute = async () => {
    if (!paymentAccount) return;
    setExecuting(true);
    setExecError('');
    setActiveStep(0);
    setBtcTxId(undefined);
    setShowProgress(true);

    try {
      await fetch(`${API_URL}/api/bot/jobs/${jobId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ btcAddress: paymentAccount.address }),
      });

      const ZERO_INTENT_ID = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

      let evmTo: `0x${string}`;
      let evmData: `0x${string}`;
      let evmValue: bigint;

      if (isSell && sellIntent) {
        if (!sellIntent.curveAddress) throw new Error('Curve address missing from sell intent');
        evmTo = sellIntent.curveAddress as `0x${string}`;
        evmData = encodeFunctionData({
          abi: BONDING_CURVE_ABI,
          functionName: 'sell',
          args: [ZERO_INTENT_ID, BigInt(sellIntent.tokenAmountBaseUnits), BigInt(sellIntent.minBtcSats)],
        });
        evmValue = BigInt(0);
      } else if (job.command === 'launch') {
        const launchI = intent as LaunchIntent | null;
        evmTo = LAUNCH_FACTORY_ADDRESS;
        evmData = encodeFunctionData({
          abi: LAUNCH_FACTORY_ABI,
          functionName: 'createLaunch',
          args: [
            launchI?.name ?? '',
            launchI?.ticker ?? '',
            BigInt(launchI?.supplyCap ?? '1000000000000000000000000'),
            BigInt(launchI?.basePrice ?? '1000'),
            BigInt(launchI?.priceIncrement ?? '100'),
            BigInt(launchI?.creatorFeeRate ?? '0'),
            launchI?.mode ?? 0,
            (launchI?.modeMetadata ?? '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`,
          ],
        });
        evmValue = BigInt(0);
      } else {
        if (!launch?.curveAddress) throw new Error('Launch curve address not found');
        evmTo = launch.curveAddress as `0x${string}`;
        evmData = encodeFunctionData({
          abi: BONDING_CURVE_ABI,
          functionName: 'buy',
          args: [ZERO_INTENT_ID, BigInt(0)],
        });
        evmValue = btcToWei(amountBtc.toString());
      }

      const intention = await addTxIntentionAsync({
        intention: {
          evmTransaction: {
            to: evmTo,
            data: evmData,
            value: evmValue,
          },
        },
        from: paymentAccount.address,
        reset: true,
      });
      setActiveStep(1);

      const fbtResult = await finalizeBTCTransactionAsync({ from: paymentAccount.address });
      setBtcTxId(fbtResult.tx.id);
      setActiveStep(2);

      const signedIntention = await signIntentionAsync({ txId: fbtResult.tx.id, intention });
      setActiveStep(3);

      await sendBTCTransactionsAsync({
        serializedTransactions: [signedIntention],
        btcTransaction: fbtResult.tx.hex,
      });

      await fetch(`${API_URL}/api/bot/jobs/${jobId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          btcTxHash: fbtResult.tx.id,
          ...(isSell
            ? {}
            : { tokensReceived: estimatedTokens != null ? String(estimatedTokens) : undefined }),
        }),
      });

      setActiveStep(4);
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

  const botTxSteps = makeBotSteps(activeStep, btcTxId);

  return (
    <>
    <TxProgress
      isOpen={showProgress}
      title={`${job.command === 'buy' ? 'Buying' : job.command === 'sell' ? 'Selling' : 'Launching'} $${job.tokenSymbol}`}
      subtitle="Bitcoin-secured · Non-custodial"
      steps={botTxSteps}
      error={execError || undefined}
      onClose={() => { setShowProgress(false); setExecError(''); }}
      successAction={btcTxId ? {
        label: 'View BTC Transaction ↗',
        href: `https://mempool.staging.midl.xyz/tx/${btcTxId}`,
      } : undefined}
    />
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
              {job.command === 'buy'
                ? `Buy $${job.tokenSymbol}`
                : job.command === 'sell'
                  ? `Sell $${job.tokenSymbol}`
                  : `Launch $${job.tokenSymbol}`}
            </span>
          </div>

          {/* Buy-specific rows */}
          {!isSell && amountBtc > 0 && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>Spending</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                {amountBtc} BTC
              </span>
            </div>
          )}
          {!isSell && estimatedTokens != null && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>Estimated</span>
              <span className="font-mono" style={{ color: 'var(--orange-500)' }}>
                ~{estimatedTokens.toLocaleString()} {job.tokenSymbol}
              </span>
            </div>
          )}
          {!isSell && minTokens != null && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>Min (1% slip)</span>
              <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                {minTokens.toLocaleString()} {job.tokenSymbol}
              </span>
            </div>
          )}

          {/* Sell-specific rows */}
          {isSell && sellTokenDisplay != null && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>Selling</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                {sellTokenDisplay} {job.tokenSymbol}
              </span>
            </div>
          )}
          {isSell && sellExpectedBtc != null && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>Expected return</span>
              <span className="font-mono" style={{ color: 'var(--orange-500)' }}>
                ~{sellExpectedBtc} BTC
              </span>
            </div>
          )}
          {isSell && sellMinBtc != null && (
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>Min return (1% slip)</span>
              <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                {sellMinBtc} BTC
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
    </>
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
