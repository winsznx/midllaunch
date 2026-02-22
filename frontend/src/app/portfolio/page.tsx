'use client';

import { useState } from 'react';
import { useAccounts } from '@midl/react';
import { AddressPurpose } from '@midl/core';
import { useAccount } from 'wagmi';
import { useUserHoldings, useUserActivity } from '@/lib/hooks/useLaunches';
import { formatTokenAmount, formatBTC } from '@/lib/wallet';
import Link from 'next/link';
import toast from 'react-hot-toast';

function tokenGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 60 + Math.abs(hash >> 8) % 60) % 360;
  return `linear-gradient(135deg, hsl(${h1},60%,30%), hsl(${h2},50%,15%))`;
}

function PnlBadge({ sats, pct }: { sats: number; pct: number }) {
  const positive = sats >= 0;
  return (
    <div className="flex items-center gap-1">
      <span
        className="font-mono text-xs font-semibold"
        style={{ color: positive ? 'var(--green-500)' : 'var(--red-500)' }}
      >
        {positive ? '+' : ''}{formatBTC(Math.abs(sats).toString())} BTC
      </span>
      <span
        className="text-xs font-mono px-1 py-0.5 rounded"
        style={{
          background: positive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: positive ? 'var(--green-500)' : 'var(--red-500)',
        }}
      >
        {positive ? '+' : ''}{pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function PortfolioPage() {
  const { accounts } = useAccounts();
  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);
  const { address: evmAddress } = useAccount();
  const [activeTab, setActiveTab] = useState<'holdings' | 'activity'>('holdings');

  const { data: holdings, isLoading: holdingsLoading } = useUserHoldings(evmAddress);
  const { data: activity, isLoading: activityLoading } = useUserActivity(evmAddress);

  if (!paymentAccount) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div
          className="inline-block rounded-2xl p-12"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
        >
          <div className="text-4xl mb-4">👛</div>
          <h2 className="font-display font-bold text-xl mb-2" style={{ color: 'var(--text-primary)' }}>
            Connect Wallet
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Connect your Bitcoin wallet to view your portfolio
          </p>
          <Link href="/launches" className="btn btn-secondary text-sm">
            Browse Launches
          </Link>
        </div>
      </div>
    );
  }

  const holdingsList = holdings?.holdings ?? [];
  const purchasesList = activity?.purchases ?? [];

  const totalUnrealizedPnl = holdingsList.reduce((s, h) => s + (h.unrealizedPnlSats ?? 0), 0);
  const totalInvested = holdingsList.reduce((s, h) => s + Number(h.totalInvested || '0'), 0);
  const totalUnrealizedPct = totalInvested > 0 ? (totalUnrealizedPnl / totalInvested) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            className="font-display font-bold mb-1"
            style={{ fontSize: '2rem', color: 'var(--text-primary)' }}
          >
            Portfolio
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
              {paymentAccount?.address}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(paymentAccount?.address ?? '');
                toast.success('Address copied');
              }}
              className="text-xs transition-colors hover:opacity-70"
              style={{ color: 'var(--text-tertiary)' }}
              title="Copy address"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {holdingsList.length > 0 && (
        <div
          className="grid gap-px grid-cols-2 sm:grid-cols-4 rounded-xl overflow-hidden mb-8"
          style={{ background: 'var(--bg-border)' }}
        >
          {[
            { label: 'Tokens Held', value: holdingsList.length.toString(), accent: false },
            {
              label: 'Total Invested',
              value: `${formatBTC(totalInvested.toFixed(0))} BTC`,
              accent: false,
            },
            { label: 'Total Purchases', value: holdingsList.reduce((s, h) => s + h.purchaseCount, 0).toString(), accent: false },
            {
              label: 'Unrealized P&L',
              value: `${totalUnrealizedPnl >= 0 ? '+' : ''}${formatBTC(Math.abs(totalUnrealizedPnl).toString())} BTC`,
              accent: true,
              positive: totalUnrealizedPnl >= 0,
            },
          ].map(({ label, value, accent, positive }) => (
            <div key={label} className="py-4 px-4" style={{ background: 'var(--bg-surface)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
              <div
                className="font-num font-bold text-base"
                style={{
                  color: accent
                    ? (positive ? 'var(--green-500)' : 'var(--red-500)')
                    : 'var(--orange-500)',
                }}
              >
                {value}
              </div>
              {accent && (
                <div className="text-xs font-mono mt-0.5"
                  style={{ color: positive ? 'var(--green-500)' : 'var(--red-500)' }}>
                  {totalUnrealizedPct >= 0 ? '+' : ''}{totalUnrealizedPct.toFixed(1)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-8 w-fit"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
      >
        {(['holdings', 'activity'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: activeTab === tab ? 'var(--orange-500)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {tab === 'holdings' ? 'Holdings' : 'My Activity'}
          </button>
        ))}
      </div>

      {/* Holdings tab */}
      {activeTab === 'holdings' && (
        holdingsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl animate-pulse h-52"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
              />
            ))}
          </div>
        ) : holdingsList.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {holdingsList.map(holding => (
              <Link
                key={holding.tokenAddress}
                href={`/launch/${holding.tokenAddress}`}
                className="rounded-xl overflow-hidden transition-all hover:scale-[1.02] block"
                style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-surface)' }}
              >
                <div className="h-12" style={{ background: tokenGradient(holding.tokenName) }} />
                <div className="p-4">
                  <div className="mb-3">
                    <div className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {holding.tokenName}
                    </div>
                    <div className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      ${holding.tokenSymbol}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Balance', value: formatTokenAmount(holding.balance) },
                      { label: 'Invested', value: `${formatBTC(holding.totalInvested || '0')} BTC` },
                      { label: 'Avg Buy', value: `${formatBTC(holding.avgBuyPriceSats?.toString() ?? '0')} BTC` },
                      { label: 'Cur. Price', value: `${formatBTC(holding.currentPriceSats?.toString() ?? '0')} BTC` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                        <span className="font-num font-medium" style={{ color: 'var(--text-secondary)' }}>{value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs pt-1" style={{ borderTop: '1px solid var(--bg-border)' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Unrealized P&L</span>
                      <PnlBadge sats={holding.unrealizedPnlSats ?? 0} pct={holding.unrealizedPnlPct ?? 0} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: 'var(--bg-surface)', border: '1px dashed var(--bg-border)' }}
          >
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>No token holdings yet</p>
            <Link href="/launches" className="btn btn-primary text-sm">Browse Launches</Link>
          </div>
        )
      )}

      {/* My Activity tab */}
      {activeTab === 'activity' && (
        activityLoading ? (
          <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-3 w-3/4 rounded" style={{ background: 'var(--bg-elevated)' }} />
                <div className="h-2 w-1/2 rounded" style={{ background: 'var(--bg-elevated)' }} />
              </div>
            ))}
          </div>
        ) : purchasesList.length > 0 ? (
          <>
            <div className="flex justify-end mb-3">
              <button
                onClick={() => {
                  const rows = [
                    ['Date', 'Token', 'Symbol', 'BTC Spent', 'Tokens', 'TX Hash'].join(','),
                    ...purchasesList.map(p => [
                      new Date(p.timestamp).toISOString(),
                      `"${p.launch.name}"`,
                      p.launch.symbol,
                      formatBTC(p.btcAmount || '0'),
                      formatTokenAmount(p.tokenAmount),
                      p.txHash || '',
                    ].join(',')),
                  ].join('\n');
                  const blob = new Blob([rows], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `midllaunch-activity-${paymentAccount?.address?.slice(0, 8)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--bg-border)' }}
              >
                ↓ Export CSV
              </button>
            </div>
            <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
              <table className="w-full text-xs min-w-[480px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-tertiary)' }}>
                    <th className="text-left px-4 py-3 font-medium">Token</th>
                    <th className="text-right px-4 py-3 font-medium">BTC Spent</th>
                    <th className="text-right px-4 py-3 font-medium">Tokens</th>
                    <th className="text-right px-4 py-3 font-medium">Date</th>
                    <th className="text-right px-4 py-3 font-medium">TX</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasesList.map(purchase => (
                    <tr key={purchase.id} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/launch/${purchase.launch.tokenAddress}`}
                          className="font-medium hover:underline"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {purchase.launch.name}
                          <span className="font-mono font-normal ml-1" style={{ color: 'var(--text-tertiary)' }}>
                            ${purchase.launch.symbol}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {formatBTC(purchase.btcAmount || '0')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--green-500)' }}>
                        +{formatTokenAmount(purchase.tokenAmount)}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(purchase.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <a
                            href={`https://blockscout.staging.midl.xyz/tx/${purchase.txHash}`}
                            target="_blank" rel="noopener noreferrer"
                            className="hover:underline"
                            style={{ color: 'var(--orange-500)' }}
                          >
                            Explorer ↗
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="rounded-xl p-12 text-center" style={{ background: 'var(--bg-surface)', border: '1px dashed var(--bg-border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No transactions yet</p>
          </div>
        )
      )}
    </div>
  );
}
