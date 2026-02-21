'use client';
import { useState, useEffect, useRef } from 'react';
import { useAccounts, useWaitForTransaction } from '@midl/react';
import { AddressPurpose } from '@midl/core';
import { useAddTxIntention, useSignIntention, useFinalizeBTCTransaction, useSendBTCTransactions } from '@midl/executor-react';
import { usePublicClient } from 'wagmi';
import { encodeFunctionData } from 'viem';
import { BONDING_CURVE_ABI, btcToWei, btcToSatoshis } from '@/lib/contracts/config';
import { formatTokenAmount, formatBTC } from '@/lib/wallet';
import type { Launch } from '@/types';
import { TxProgress, type TxStep } from '@/components/ui/TxProgress';

interface BuyPanelProps {
  launch: Launch;
  onSuccess?: (txHash: string) => void;
  defaultBtcAmount?: string;
}

const QUICK_AMOUNTS = ['0.001', '0.005', '0.01'];

function makeBuySteps(completedStep: number, btcTxId?: string): TxStep[] {
  const labels = [
    { label: 'Queue EVM intent', detail: undefined as string | undefined },
    { label: 'Build BTC transaction', detail: btcTxId ? `${btcTxId.slice(0, 16)}…` : undefined },
    { label: 'Sign with wallet (BIP-322)', detail: undefined as string | undefined },
    { label: 'Broadcast to Midl', detail: undefined as string | undefined },
  ];
  return labels.map((s, i) => ({
    label: s.label,
    detail: s.detail,
    status: i < completedStep ? 'done' : i === completedStep ? 'active' : 'pending',
  }));
}

export function BuyPanel({ launch, onSuccess, defaultBtcAmount }: BuyPanelProps) {
  const { accounts } = useAccounts();
  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);
  const publicClient = usePublicClient();

  const { addTxIntentionAsync } = useAddTxIntention();
  const { signIntentionAsync } = useSignIntention();
  const { finalizeBTCTransactionAsync } = useFinalizeBTCTransaction();
  const { sendBTCTransactionsAsync } = useSendBTCTransactions();
  const { waitForTransactionAsync } = useWaitForTransaction();

  const [btcAmount, setBtcAmount] = useState(defaultBtcAmount ?? '');
  const [slippage, setSlippage] = useState('1');
  const [showSlippage, setShowSlippage] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [estimatedTokens, setEstimatedTokens] = useState<bigint>(BigInt(0));
  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [btcTxId, setBtcTxId] = useState<string | undefined>();
  const [showProgress, setShowProgress] = useState(false);
  const estimateTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(estimateTimer.current);
    if (!btcAmount || !launch || parseFloat(btcAmount) <= 0 || !publicClient) {
      setEstimatedTokens(BigInt(0));
      setPriceImpact(null);
      return;
    }
    estimateTimer.current = setTimeout(async () => {
      try {
        const sats = btcToSatoshis(btcAmount);
        const result = await publicClient.readContract({
          address: launch.curveAddress as `0x${string}`,
          abi: BONDING_CURVE_ABI,
          functionName: 'calculatePurchaseReturn',
          args: [sats, BigInt(launch.currentSupply || '0')],
        }) as bigint;
        setEstimatedTokens(result);

        // Price impact: effective sat/token vs current sat/token
        if (result > BigInt(0)) {
          const effectiveSatsPerToken = Number(sats) / (Number(result) / 1e18);
          const currentSatsPerToken = parseFloat(launch.currentPrice ?? '0');
          if (currentSatsPerToken > 0) {
            const impact = ((effectiveSatsPerToken - currentSatsPerToken) / currentSatsPerToken) * 100;
            setPriceImpact(impact);
          }
        }
      } catch {
        setEstimatedTokens(BigInt(0));
        setPriceImpact(null);
      }
    }, 400);
    return () => clearTimeout(estimateTimer.current);
  }, [btcAmount, launch, publicClient]);

  const handleBuy = async () => {
    if (!paymentAccount) { setBuyError('Connect your wallet first'); return; }
    if (!btcAmount || parseFloat(btcAmount) <= 0) { setBuyError('Enter a BTC amount'); return; }

    setIsBuying(true);
    setBuyError(null);
    setActiveStep(0);
    setBtcTxId(undefined);
    setShowProgress(true);

    try {
      const slippageBP = BigInt(Math.round((1 - parseFloat(slippage) / 100) * 10_000));
      const minTokensOut = (estimatedTokens * slippageBP) / BigInt(10_000);

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
            value: btcToWei(btcAmount),
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
      setActiveStep(4);

      await waitForTransactionAsync({ txId: fbtResult.tx.id });
      onSuccess?.(fbtResult.tx.id);
      setBtcAmount('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      setBuyError(msg);
    } finally {
      setIsBuying(false);
    }
  };

  const minReceived = estimatedTokens > BigInt(0)
    ? (Number(estimatedTokens) * (1 - parseFloat(slippage) / 100)) / 1e18
    : 0;

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/launch/${launch.tokenAddress}${paymentAccount ? `?ref=${paymentAccount.address}` : ''}`
    : '';

  const txSteps: TxStep[] = makeBuySteps(activeStep, btcTxId);

  return (
    <>
    <TxProgress
      isOpen={showProgress}
      title={`Buying ${launch.symbol}`}
      subtitle="Bitcoin-secured · Non-custodial"
      steps={txSteps}
      error={buyError}
      onClose={() => { setShowProgress(false); setBuyError(null); }}
      successAction={btcTxId ? {
        label: 'View BTC Transaction ↗',
        href: `https://mempool.staging.midl.xyz/tx/${btcTxId}`,
      } : undefined}
    />
    <div className="space-y-4">
      <div
        className="rounded-xl p-5 space-y-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
      >
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Buy {launch.symbol}</h3>

        {/* Quick amounts */}
        <div className="flex gap-2">
          {QUICK_AMOUNTS.map(amt => (
            <button
              key={amt}
              onClick={() => setBtcAmount(amt)}
              className="flex-1 py-1.5 rounded-lg text-xs font-mono transition-all"
              style={{
                background: btcAmount === amt ? 'var(--orange-500)' : 'var(--bg-elevated)',
                color: btcAmount === amt ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--bg-border)',
              }}
            >
              {amt} BTC
            </button>
          ))}
        </div>

        {/* BTC input */}
        <div className="relative">
          <input
            type="number"
            value={btcAmount}
            onChange={e => setBtcAmount(e.target.value)}
            placeholder="0.000"
            min="0"
            step="0.001"
            className="input pr-14 font-mono"
          />
          <span
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono"
            style={{ color: 'var(--text-tertiary)' }}
          >
            BTC
          </span>
        </div>

        {/* Estimate */}
        {estimatedTokens > BigInt(0) && (
          <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex justify-between">
              <span>You receive</span>
              <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                ~{formatTokenAmount((estimatedTokens).toString())} {launch.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Min received</span>
              <span className="font-mono">~{minReceived.toFixed(2)} {launch.symbol}</span>
            </div>
            {priceImpact !== null && (
              <div className="flex justify-between">
                <span>Price impact</span>
                <span
                  className="font-mono"
                  style={{
                    color: priceImpact > 5
                      ? 'var(--red-500)'
                      : priceImpact > 2
                      ? '#eab308'
                      : 'var(--green-500)',
                  }}
                >
                  {priceImpact > 0 ? '+' : ''}{priceImpact.toFixed(2)}%
                </span>
              </div>
            )}
            {launch.creatorFeeRate && (
              <div className="flex justify-between" style={{ color: 'var(--text-tertiary)' }}>
                <span>Creator fee</span>
                <span className="font-mono">
                  {(Number(launch.creatorFeeRate) / 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Slippage */}
        <div>
          <button
            onClick={() => setShowSlippage(!showSlippage)}
            className="text-xs flex items-center gap-1 transition-colors hover:opacity-80"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Slippage: {slippage}% {showSlippage ? '▲' : '▼'}
          </button>
          {showSlippage && (
            <div className="flex gap-2 mt-2">
              {['0.5', '1', '2'].map(s => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className="flex-1 py-1 rounded text-xs font-mono transition-all"
                  style={{
                    background: slippage === s ? 'var(--orange-100)' : 'var(--bg-elevated)',
                    color: slippage === s ? 'var(--orange-500)' : 'var(--text-secondary)',
                    border: `1px solid ${slippage === s ? 'var(--orange-500)' : 'var(--bg-border)'}`,
                  }}
                >
                  {s}%
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Buy button */}
        <button
          onClick={handleBuy}
          disabled={isBuying || !btcAmount || parseFloat(btcAmount) <= 0}
          className="btn-primary w-full py-3 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBuying ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
              Processing…
            </span>
          ) : (
            `Buy ${launch.symbol}`
          )}
        </button>

      </div>

      {/* Share section */}
      {shareUrl && (
        <div
          className="rounded-xl p-4 space-y-2"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Share & earn referral</p>
          <div className="flex items-center gap-2">
            <span
              className="flex-1 font-mono text-xs truncate px-2 py-1.5 rounded"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}
            >
              {shareUrl.replace('https://', '').slice(0, 40)}…
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="px-3 py-1.5 rounded text-xs transition-all hover:opacity-80"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--bg-border)' }}
            >
              Copy 📋
            </button>
          </div>
          <a
            href={`https://twitter.com/intent/tweet?text=Check out ${launch.name} ($${launch.symbol}) on MidlLaunch&url=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-medium transition-all hover:opacity-90"
            style={{ background: '#000', color: '#fff' }}
          >
            Share on 𝕏
          </a>
        </div>
      )}

      {/* Token info */}
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
      >
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Token Info</p>
        {[
          ['Creator', `${launch.creator.slice(0, 8)}…${launch.creator.slice(-6)}`],
          ['Supply Cap', `${formatTokenAmount(launch.supplyCap)} ${launch.symbol}`],
          ['Base Price', `${formatBTC(launch.basePrice)} BTC`],
          ['Price Step', `${formatBTC(launch.priceIncrement)} BTC/token`],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between text-xs">
            <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
            <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{value}</span>
          </div>
        ))}
        {(launch as Launch & { twitterUrl?: string; telegramUrl?: string; websiteUrl?: string }).twitterUrl || (launch as Launch & { twitterUrl?: string; telegramUrl?: string; websiteUrl?: string }).telegramUrl || (launch as Launch & { twitterUrl?: string; telegramUrl?: string; websiteUrl?: string }).websiteUrl ? (
          <div className="flex gap-3 pt-2">
            {(launch as Launch & { twitterUrl?: string }).twitterUrl && (
              <a href={(launch as Launch & { twitterUrl?: string }).twitterUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs hover:underline" style={{ color: 'var(--orange-500)' }}>Twitter</a>
            )}
            {(launch as Launch & { telegramUrl?: string }).telegramUrl && (
              <a href={(launch as Launch & { telegramUrl?: string }).telegramUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs hover:underline" style={{ color: 'var(--orange-500)' }}>Telegram</a>
            )}
            {(launch as Launch & { websiteUrl?: string }).websiteUrl && (
              <a href={(launch as Launch & { websiteUrl?: string }).websiteUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs hover:underline" style={{ color: 'var(--orange-500)' }}>Website</a>
            )}
          </div>
        ) : null}
      </div>
    </div>
    </>
  );
}
