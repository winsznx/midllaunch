'use client';

import { useAccounts } from '@midl/react';
import { AddressPurpose } from '@midl/core';
import { useUserActivity, useLaunch } from '@/lib/hooks/useLaunches';
import Link from 'next/link';
import Image from 'next/image';
import { Rocket, TrendingUp, ExternalLink, Wallet } from 'lucide-react';
import { formatBTC, formatTokenAmount } from '@/lib/wallet';
import { ipfsUriToHttp } from '@/lib/ipfs/upload';
import type { ActivityLaunch } from '@/types';

function formatMarketCap(sats: number): string {
  if (sats === 0) return '—';
  const btc = sats / 1e8;
  if (btc >= 1) return `${btc.toFixed(2)} BTC`;
  if (btc >= 0.001) return `${btc.toFixed(4)} BTC`;
  return `${Math.round(sats).toLocaleString()} sats`;
}

function TokenRow({ activity }: { activity: ActivityLaunch }) {
  const { data: launch } = useLaunch(activity.tokenAddress);

  const progress = launch?.currentSupply && launch?.supplyCap
    ? Math.min(Number(BigInt(launch.currentSupply) * BigInt(10000) / BigInt(launch.supplyCap)) / 100, 100)
    : 0;

  const marketCapSats = launch?.currentPrice && launch?.currentSupply
    ? parseFloat(launch.currentPrice) * (Number(launch.currentSupply) / 1e18)
    : 0;

  const imageUrl = activity.imageUrl || (launch?.metadataUri ? ipfsUriToHttp(launch.metadataUri) : null);

  return (
    <Link
      href={`/launch/${activity.tokenAddress}`}
      className="flex items-center gap-4 p-4 rounded-xl transition-all duration-200 hover:opacity-80"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', boxShadow: '3px 3px 0 rgba(0,0,0,0.7)' }}
    >
      {/* Token image */}
      <div
        className="w-12 h-12 rounded-xl flex-shrink-0 relative overflow-hidden"
        style={{ background: imageUrl ? 'var(--bg-elevated)' : `hsl(${activity.name.charCodeAt(0) * 13 % 360},60%,25%)` }}
      >
        {imageUrl && (
          <Image src={imageUrl} alt={activity.name} fill className="object-cover" sizes="48px" />
        )}
        {!imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-white/60">{activity.symbol?.slice(0, 2)}</span>
          </div>
        )}
      </div>

      {/* Name + symbol */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {activity.name}
        </div>
        <div className="text-xs font-mono" style={{ color: 'var(--orange-500)' }}>${activity.symbol}</div>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
        <div className="text-right">
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Price</div>
          <div className="text-sm font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
            {launch?.currentPrice ? `${formatBTC(launch.currentPrice)} BTC` : '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Market Cap</div>
          <div className="text-sm font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
            {formatMarketCap(marketCapSats)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Progress</div>
          <div className="text-sm font-mono font-medium" style={{ color: progress >= 80 ? 'var(--green-500)' : progress >= 50 ? '#eab308' : 'var(--orange-500)' }}>
            {launch ? `${progress.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Supply</div>
          <div className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
            {launch?.currentSupply ? formatTokenAmount(launch.currentSupply) : '—'}
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={launch?.status === 'FINALIZED' ? {
            background: 'rgba(34,197,94,0.12)',
            color: 'var(--green-500)',
            border: '1px solid rgba(34,197,94,0.3)',
          } : {
            background: 'rgba(249,115,22,0.1)',
            color: 'var(--orange-500)',
            border: '1px solid rgba(249,115,22,0.3)',
          }}
        >
          {launch?.status ?? 'ACTIVE'}
        </span>
      </div>

      <ExternalLink size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
    </Link>
  );
}

export default function MyTokensPage() {
  const { accounts } = useAccounts();
  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);
  const { data, isLoading } = useUserActivity(paymentAccount?.address);

  const launches = data?.launches ?? [];

  if (!paymentAccount) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
        >
          <Wallet size={40} className="mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
          <h2 className="font-display font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
            Connect your wallet
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Connect your Bitcoin wallet to see the tokens you&apos;ve launched.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full mb-3"
            style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--orange-500)', border: '1px solid rgba(249,115,22,0.3)' }}
          >
            <Rocket size={11} />
            Creator Dashboard
          </div>
          <h1 className="font-display font-bold text-3xl" style={{ color: 'var(--text-primary)' }}>
            My Tokens
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            All token launches you&apos;ve created · {launches.length} total
          </p>
        </div>
        <Link href="/create" className="btn btn-primary flex items-center gap-2 text-sm w-fit">
          <Rocket size={14} />
          Launch New Token
        </Link>
      </div>

      {/* Summary stats */}
      {launches.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Tokens Launched', value: launches.length },
            { label: 'Also Created NFTs', value: data?.nftLaunches?.length ?? 0 },
            { label: 'Total Transactions', value: data?.total ?? 0 },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
            >
              <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
              <div className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Token list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl animate-pulse"
              style={{ background: 'var(--bg-surface)' }}
            />
          ))}
        </div>
      ) : launches.length > 0 ? (
        <div className="space-y-3">
          {launches.map(activity => (
            <TokenRow key={activity.tokenAddress} activity={activity} />
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl p-16 text-center"
          style={{ background: 'var(--bg-surface)', border: '1px dashed var(--bg-border)' }}
        >
          <TrendingUp size={40} className="mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            No tokens yet
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            You haven&apos;t launched any tokens. Create your first memecoin in minutes.
          </p>
          <Link href="/create" className="btn btn-primary text-sm">
            Launch Your First Token
          </Link>
        </div>
      )}
    </div>
  );
}
