'use client';

import { useAccounts } from '@midl/react';
import { AddressPurpose } from '@midl/core';
import { useUserActivity } from '@/lib/hooks/useLaunches';
import { formatTokenAmount, formatBTC } from '@/lib/wallet';
import Link from 'next/link';

type TxState = 'SIGNED' | 'BTC_INCLUDED' | 'MIDL_EXECUTED' | 'FINALIZED' | 'FAILED' | 'REFUNDED';

const TX_STATES: { state: TxState; label: string; color: string; bg: string }[] = [
  { state: 'SIGNED', label: 'Signed', color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
  { state: 'BTC_INCLUDED', label: 'BTC Conf.', color: 'var(--orange-500)', bg: 'var(--orange-glow)' },
  { state: 'MIDL_EXECUTED', label: 'Midl Exec.', color: 'var(--orange-500)', bg: 'var(--orange-glow)' },
  { state: 'FINALIZED', label: 'Finalized', color: 'var(--green-500)', bg: 'rgba(34,197,94,0.1)' },
  { state: 'FAILED', label: 'Failed', color: 'var(--red-500)', bg: 'rgba(239,68,68,0.1)' },
  { state: 'REFUNDED', label: 'Refunded', color: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' },
];

function stateStyle(state: string) {
  return TX_STATES.find(s => s.state === state) ?? TX_STATES[0];
}

const LIFECYCLE_STEPS: { state: TxState; label: string; desc: string }[] = [
  { state: 'SIGNED', label: '1. Signed', desc: 'BTC transaction signed by wallet' },
  { state: 'BTC_INCLUDED', label: '2. BTC Confirmed', desc: 'Included in a Bitcoin block' },
  { state: 'MIDL_EXECUTED', label: '3. Midl Executed', desc: 'EVM transaction executed on Midl' },
  { state: 'FINALIZED', label: '4. Finalized', desc: 'Settlement complete and irreversible' },
];

export default function TransactionsPage() {
  const { accounts } = useAccounts();
  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);
  const address = paymentAccount?.address;

  const { data: activity, isLoading } = useUserActivity(address);
  const purchases = activity?.purchases ?? [];

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="font-display font-bold mb-1"
          style={{ fontSize: '2rem', color: 'var(--text-primary)' }}
        >
          Transaction Center
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Bitcoin-to-Midl transaction lifecycle · Real-time settlement tracking
        </p>
      </div>

      {/* Lifecycle explainer */}
      <div
        className="rounded-xl p-5 mb-8"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--text-tertiary)' }}>
          Transaction Lifecycle (Section 9.9)
        </h3>
        <div className="flex items-start gap-0">
          {LIFECYCLE_STEPS.map((step, i) => (
            <div key={step.state} className="flex-1 relative">
              {/* Connector line */}
              {i < LIFECYCLE_STEPS.length - 1 && (
                <div
                  className="absolute top-3 left-1/2 right-0 h-px"
                  style={{ background: 'var(--bg-border)' }}
                />
              )}
              <div className="flex flex-col items-center text-center px-2 relative z-10">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-2"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-tertiary)' }}
                >
                  {i + 1}
                </div>
                <div className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {step.label.split('. ')[1]}
                </div>
                <div className="text-xs leading-tight" style={{ color: 'var(--text-tertiary)' }}>
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* No wallet */}
      {!paymentAccount && (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--bg-surface)', border: '1px dashed var(--bg-border)' }}
        >
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Connect your wallet to see your transactions
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/launches" className="btn btn-primary text-sm">Buy Tokens</Link>
            <Link href="/create" className="btn btn-secondary text-sm">Create Launch</Link>
          </div>
        </div>
      )}

      {/* Loading */}
      {paymentAccount && isLoading && (
        <div
          className="rounded-xl p-6 space-y-5"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
        >
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between animate-pulse">
              <div className="space-y-2">
                <div className="h-3 w-32 rounded" style={{ background: 'var(--bg-elevated)' }} />
                <div className="h-2 w-48 rounded" style={{ background: 'var(--bg-elevated)' }} />
              </div>
              <div className="h-6 w-20 rounded-full" style={{ background: 'var(--bg-elevated)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Transactions list */}
      {paymentAccount && !isLoading && purchases.length > 0 && (
        <div
          className="rounded-xl overflow-hidden divide-y"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderColor: 'var(--bg-border)' }}
        >
          {purchases.map(purchase => {
            // Derive state from what data exists (backend doesn't have a state field yet — infer FINALIZED if txHash present)
            const state: TxState = purchase.txHash ? 'FINALIZED' : 'BTC_INCLUDED';
            const style = stateStyle(state);

            return (
              <div key={purchase.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        Token Purchase
                      </span>
                      <Link
                        href={`/launch/${purchase.launch.tokenAddress}`}
                        className="text-xs hover:underline"
                        style={{ color: 'var(--orange-500)' }}
                      >
                        View launch →
                      </Link>
                    </div>

                    <div className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(purchase.timestamp).toLocaleString()} ·{' '}
                      <span className="font-mono">{purchase.intentId.slice(0, 14)}…</span>
                    </div>

                    {/* Token amounts */}
                    <div
                      className="inline-flex items-center gap-4 px-3 py-2 rounded-lg text-xs"
                      style={{ background: 'var(--bg-elevated)' }}
                    >
                      <span>
                        <span style={{ color: 'var(--text-tertiary)' }}>Paid </span>
                        <span className="font-num font-medium" style={{ color: 'var(--text-primary)' }}>
                          {formatBTC(purchase.btcAmount || '0')} BTC
                        </span>
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                      <span>
                        <span style={{ color: 'var(--text-tertiary)' }}>Received </span>
                        <span className="font-num font-medium" style={{ color: 'var(--green-500)' }}>
                          {formatTokenAmount(purchase.tokenAmount)} tokens
                        </span>
                      </span>
                    </div>

                    {/* Explorer links */}
                    <div className="flex gap-4 mt-3">
                      {purchase.intentId && (
                        <a
                          href={`https://mempool.staging.midl.xyz/tx/${purchase.intentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs hover:underline"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          BTC Explorer ↗
                        </a>
                      )}
                      {purchase.txHash && (
                        <a
                          href={`https://blockscout.staging.midl.xyz/tx/${purchase.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs hover:underline"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          Midl Explorer ↗
                        </a>
                      )}
                    </div>
                  </div>

                  {/* State badge */}
                  <div
                    className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: style.bg, color: style.color }}
                  >
                    {style.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state (connected, loaded, no txns) */}
      {paymentAccount && !isLoading && purchases.length === 0 && (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--bg-surface)', border: '1px dashed var(--bg-border)' }}
        >
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            No transactions yet
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/launches" className="btn btn-primary text-sm">Buy Tokens</Link>
            <Link href="/create" className="btn btn-secondary text-sm">Create Launch</Link>
          </div>
        </div>
      )}
    </div>
  );
}
