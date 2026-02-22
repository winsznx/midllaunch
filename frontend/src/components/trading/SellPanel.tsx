'use client';
import { useState, useEffect, useRef } from 'react';
import { useAccounts, useWaitForTransaction } from '@midl/react';
import { AddressPurpose } from '@midl/core';
import { useAddTxIntention, useSignIntention, useFinalizeBTCTransaction } from '@midl/executor-react';
import { usePublicClient, useReadContract } from 'wagmi';
import { encodeFunctionData, erc20Abi, keccak256 } from 'viem';
import { BONDING_CURVE_ABI } from '@/lib/contracts/config';
import { formatTokenAmount, formatBTC } from '@/lib/wallet';
import type { Launch } from '@/types';
import { TxProgress, type TxStep } from '@/components/ui/TxProgress';

interface SellPanelProps {
  launch: Launch;
  onSuccess?: (txHash: string) => void;
}

const PCT_PRESETS = [25, 50, 75, 100] as const;

function makeSellSteps(activeStep: number, btcTxId?: string): TxStep[] {
  const defs: { label: string; activeDetail?: string; doneDetail?: string }[] = [
    { label: 'Queue EVM intent', activeDetail: 'Encoding sell calldata for bonding curve' },
    {
      label: 'Build BTC transaction',
      activeDetail: 'Wallet opening · Signing your UTXOs',
      doneDetail: btcTxId ? `${btcTxId.slice(0, 20)}…` : undefined,
    },
    { label: 'Sign with wallet (BIP-322)', activeDetail: 'Linking EVM intent to BTC tx' },
    { label: 'Broadcast to Bitcoin + Midl', activeDetail: 'Submitting both transactions to network' },
    { label: 'Awaiting settlement', activeDetail: 'BTC confirmation → Midl EVM execution' },
  ];
  return defs.map((s, i) => ({
    label: s.label,
    detail: i < activeStep ? s.doneDetail : i === activeStep ? s.activeDetail : undefined,
    status: i < activeStep ? 'done' : i === activeStep ? 'active' : 'pending',
  }));
}

export function SellPanel({ launch, onSuccess }: SellPanelProps) {
  const { accounts } = useAccounts();
  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);
  const publicClient = usePublicClient();

  const { addTxIntentionAsync, txIntentions } = useAddTxIntention();
  const txIntentionsRef = useRef(txIntentions);
  useEffect(() => { txIntentionsRef.current = txIntentions; }, [txIntentions]);
  const { signIntentionAsync } = useSignIntention();
  const { finalizeBTCTransactionAsync } = useFinalizeBTCTransaction();
  const { waitForTransactionAsync } = useWaitForTransaction();

  // Token balance of the connected wallet
  const { data: rawBalance } = useReadContract({
    address: launch.tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: paymentAccount ? [paymentAccount.address as `0x${string}`] : undefined,
    query: { enabled: !!paymentAccount },
  });
  const tokenBalance: bigint = rawBalance ?? BigInt(0);
  const tokenBalanceWhole = Number(tokenBalance) / 1e18;

  const [pctSelected, setPctSelected] = useState<number | null>(null);
  const [tokenAmount, setTokenAmount] = useState('');
  const [slippage, setSlippage] = useState('1');
  const [showSlippage, setShowSlippage] = useState(false);

  const [estimatedBtc, setEstimatedBtc] = useState<bigint>(BigInt(0));
  const [priceImpact, setPriceImpact] = useState<number | null>(null);

  const [isSelling, setIsSelling] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [btcTxId, setBtcTxId] = useState<string | undefined>();
  const [evmTxHash, setEvmTxHash] = useState<string | undefined>();
  const [showProgress, setShowProgress] = useState(false);
  const [successSummary, setSuccessSummary] = useState<string | undefined>();

  const estimateTimer = useRef<ReturnType<typeof setTimeout>>();

  // Sync pct → tokenAmount
  const handlePctClick = (pct: number) => {
    setPctSelected(pct);
    const amount = (tokenBalanceWhole * pct) / 100;
    setTokenAmount(amount > 0 ? amount.toFixed(6).replace(/\.?0+$/, '') : '');
  };

  // If user types manually, clear pct selection
  const handleAmountChange = (val: string) => {
    setTokenAmount(val);
    setPctSelected(null);
  };

  // Estimate BTC out
  useEffect(() => {
    clearTimeout(estimateTimer.current);
    if (!tokenAmount || !launch || parseFloat(tokenAmount) <= 0 || !publicClient) {
      setEstimatedBtc(BigInt(0));
      setPriceImpact(null);
      return;
    }
    estimateTimer.current = setTimeout(async () => {
      try {
        const tokenAmountBaseUnits = BigInt(Math.floor(parseFloat(tokenAmount) * 1e18));
        const onChainSupply = await publicClient!.readContract({
          address: launch.tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'totalSupply',
        }) as bigint;

        const result = await publicClient.readContract({
          address: launch.curveAddress as `0x${string}`,
          abi: BONDING_CURVE_ABI,
          functionName: 'calculateSaleReturn',
          args: [tokenAmountBaseUnits, onChainSupply],
        }) as bigint;

        setEstimatedBtc(result);

        // Price impact: effective sats/token vs current price
        if (result > BigInt(0) && parseFloat(tokenAmount) > 0) {
          const effectiveSatsPerToken = Number(result) / parseFloat(tokenAmount);
          const currentSatsPerToken = parseFloat(launch.currentPrice ?? '0');
          if (currentSatsPerToken > 0) {
            const impact = ((currentSatsPerToken - effectiveSatsPerToken) / currentSatsPerToken) * 100;
            setPriceImpact(impact);
          }
        }
      } catch {
        setEstimatedBtc(BigInt(0));
        setPriceImpact(null);
      }
    }, 400);
    return () => clearTimeout(estimateTimer.current);
  }, [tokenAmount, launch, publicClient]);

  const handleSell = async () => {
    if (!paymentAccount) { setSellError('Connect your wallet first'); return; }
    if (!tokenAmount || parseFloat(tokenAmount) <= 0) { setSellError('Enter a token amount'); return; }
    if (tokenBalance === BigInt(0)) { setSellError('You have no tokens to sell'); return; }

    const tokenAmountBaseUnits = BigInt(Math.floor(parseFloat(tokenAmount) * 1e18));
    if (tokenAmountBaseUnits > tokenBalance) {
      setSellError('Amount exceeds your balance');
      return;
    }

    setIsSelling(true);
    setSellError(null);
    setActiveStep(0);
    setBtcTxId(undefined);
    setEvmTxHash(undefined);
    setSuccessSummary(undefined);
    setShowProgress(true);

    try {
      const slippageBP = BigInt(Math.round((1 - parseFloat(slippage) / 100) * 10_000));
      const minBtcOut = (estimatedBtc * slippageBP) / BigInt(10_000);

      const data = encodeFunctionData({
        abi: BONDING_CURVE_ABI,
        functionName: 'sell',
        args: [
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          tokenAmountBaseUnits,
          minBtcOut,
        ],
      });

      const intention = await addTxIntentionAsync({
        intention: {
          evmTransaction: {
            to: launch.curveAddress as `0x${string}`,
            data,
            value: BigInt(0),
          },
          withdraw: {
            satoshis: Number(estimatedBtc),
          },
        },
        from: paymentAccount.address,
        reset: true,
      });
      setActiveStep(1);

      const fbtResult = await finalizeBTCTransactionAsync({ from: paymentAccount.address });
      setBtcTxId(fbtResult.tx.id);
      setActiveStep(2);

      await signIntentionAsync({ txId: fbtResult.tx.id, intention });
      setActiveStep(3);

      const signedTx = txIntentionsRef.current[0].signedEvmTransaction as `0x${string}`;
      setEvmTxHash(keccak256(signedTx));

      await publicClient?.sendBTCTransactions({
        serializedTransactions: txIntentionsRef.current.map(it => it.signedEvmTransaction as `0x${string}`),
        btcTransaction: fbtResult.tx.hex,
      });
      setActiveStep(4);

      await waitForTransactionAsync({ txId: fbtResult.tx.id });
      setActiveStep(5);
      const btcReceived = (Number(estimatedBtc) / 1e8).toFixed(8).replace(/\.?0+$/, '');
      setSuccessSummary(`Sold ${tokenAmount} ${launch.symbol} for ${btcReceived} BTC`);
      window.dispatchEvent(new Event('midl:tx-success'));
      onSuccess?.(fbtResult.tx.id);
      setTokenAmount('');
      setPctSelected(null);
    } catch (err) {
      setSellError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsSelling(false);
    }
  };

  const minBtcReceived = estimatedBtc > BigInt(0)
    ? (Number(estimatedBtc) * (1 - parseFloat(slippage) / 100)) / 1e8
    : 0;

  const sellSteps = makeSellSteps(activeStep, btcTxId);

  const hasBalance = tokenBalance > BigInt(0);
  const inputExceedsBalance =
    tokenAmount && parseFloat(tokenAmount) > 0
      ? BigInt(Math.floor(parseFloat(tokenAmount) * 1e18)) > tokenBalance
      : false;

  return (
    <>
      <TxProgress
        isOpen={showProgress}
        title={`Selling ${launch.symbol}`}
        subtitle="Bitcoin-secured · Non-custodial"
        steps={sellSteps}
        error={sellError ?? undefined}
        btcTxId={btcTxId}
        evmTxHash={evmTxHash}
        successSummary={successSummary}
        onClose={() => { setShowProgress(false); setSellError(null); }}
      />

      <div className="space-y-4">
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Sell {launch.symbol}
            </h3>
            {hasBalance && (
              <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                Balance: {tokenBalanceWhole.toLocaleString(undefined, { maximumFractionDigits: 4 })} {launch.symbol}
              </span>
            )}
          </div>

          {/* % presets */}
          <div className="flex gap-2">
            {PCT_PRESETS.map(pct => (
              <button
                key={pct}
                onClick={() => handlePctClick(pct)}
                disabled={!hasBalance}
                className="flex-1 py-1.5 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
                style={{
                  background: pctSelected === pct ? 'var(--orange-500)' : 'var(--bg-elevated)',
                  color: pctSelected === pct ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--bg-border)',
                }}
              >
                {pct === 100 ? 'MAX' : `${pct}%`}
              </button>
            ))}
          </div>

          {/* Token amount input */}
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={tokenAmount}
              onChange={e => {
                const v = e.target.value;
                if (v === '' || /^\d*\.?\d*$/.test(v)) handleAmountChange(v);
              }}
              placeholder="0.00"
              className="input pr-20 font-mono"
              style={inputExceedsBalance ? { borderColor: 'var(--red-500)' } : {}}
            />
            <span
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {launch.symbol}
            </span>
          </div>
          {inputExceedsBalance && (
            <p className="text-xs" style={{ color: 'var(--red-500)' }}>Exceeds your balance</p>
          )}

          {/* Estimate */}
          {estimatedBtc > BigInt(0) && (
            <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex justify-between">
                <span>You receive</span>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                  ~{formatBTC(estimatedBtc.toString())} BTC
                </span>
              </div>
              <div className="flex justify-between">
                <span>Min received</span>
                <span className="font-mono">~{minBtcReceived.toFixed(8)} BTC</span>
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
                    -{priceImpact.toFixed(2)}%
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

          {/* Sell button */}
          <button
            onClick={handleSell}
            disabled={isSelling || !tokenAmount || parseFloat(tokenAmount) <= 0 || inputExceedsBalance || !hasBalance}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, var(--red-500), #dc2626)',
              color: '#fff',
              boxShadow: '0 2px 12px rgba(239,68,68,0.3)',
            }}
          >
            {isSelling ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                Processing…
              </span>
            ) : (
              `Sell ${launch.symbol}`
            )}
          </button>

          {!hasBalance && paymentAccount && (
            <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
              You don&apos;t hold any {launch.symbol} tokens yet.
            </p>
          )}
        </div>

        {/* Token info */}
        <div
          className="rounded-xl p-4 space-y-2"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
        >
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Token Info</p>
          {[
            ['Current Price', `${formatBTC(launch.currentPrice ?? '0')} BTC`],
            ['Your Balance', hasBalance ? `${tokenBalanceWhole.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${launch.symbol}` : '—'],
            ['Supply Sold', `${formatTokenAmount(launch.currentSupply ?? '0')} / ${formatTokenAmount(launch.supplyCap)}`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-xs">
              <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
              <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
