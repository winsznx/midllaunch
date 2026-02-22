'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import type { Launch } from '@/types';
import { formatTokenAmount, formatBTC } from '@/lib/wallet';
import { ipfsUriToHttp } from '@/lib/ipfs/upload';

function tokenGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40 + Math.abs(hash >> 8) % 80) % 360;
  const h3 = (h2 + 60 + Math.abs(hash >> 16) % 60) % 360;
  return `radial-gradient(ellipse at 30% 30%, hsl(${h1},70%,35%), hsl(${h2},60%,20%) 50%, hsl(${h3},50%,10%))`;
}

function progressColor(pct: number): string {
  if (pct >= 80) return 'var(--green-500)';
  if (pct >= 50) return '#eab308';
  return 'var(--orange-500)';
}

function isRecentlyActive(launch: Launch): boolean {
  if (!launch.timestamp) return false;
  return Date.now() - new Date(launch.timestamp).getTime() < 60_000;
}

function formatMarketCap(sats: number): string {
  if (sats === 0) return '—';
  const btc = sats / 1e8;
  if (btc >= 1) return `${btc.toFixed(2)} BTC`;
  if (btc >= 0.001) return `${btc.toFixed(4)} BTC`;
  return `${Math.round(sats).toLocaleString()} sats`;
}

// CSS-only confetti particles for 100% graduation
function GraduationBurst() {
  // Pre-computed horizontal offsets to simulate circular spread (no CSS sin())
  const offsets = [-50, -35, -15, 0, 15, 35, 50, 35, 15, 0, -15, -35];
  const colors = ['#f97316', '#22c55e', '#eab308', '#3b82f6', '#ec4899', '#a855f7'];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {offsets.map((dx, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: '50%',
            top: '40%',
            width: `${4 + (i % 3) * 2}px`,
            height: `${4 + (i % 3) * 2}px`,
            borderRadius: i % 2 === 0 ? '50%' : '1px',
            background: colors[i % colors.length],
            animation: `confettiParticle 1.4s ease-out ${i * 55}ms both`,
            '--dx': `${dx}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

interface TokenCardProps {
  launch: Launch;
  index?: number;
}

export function TokenCard({ launch, index = 0 }: TokenCardProps) {
  const [imgError, setImgError] = useState(false);

  const progress = launch.currentSupply && launch.supplyCap
    ? Math.min(Number(BigInt(launch.currentSupply) * BigInt(10000) / BigInt(launch.supplyCap)) / 100, 100)
    : 0;

  const isGraduated = launch.status === 'FINALIZED' || progress >= 100;
  const live = isRecentlyActive(launch);

  const imageUrl = !imgError && (launch.imageUrl || launch.metadataUri)
    ? (launch.imageUrl || ipfsUriToHttp(launch.metadataUri!))
    : null;

  const marketCapSats = launch.currentPrice && launch.currentSupply
    ? parseFloat(launch.currentPrice) * (Number(launch.currentSupply) / 1e18)
    : 0;

  return (
    <Link
      href={`/launch/${launch.tokenAddress}`}
      className="group block rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{
        border: isGraduated
          ? '1px solid var(--green-500)'
          : '1px solid var(--bg-border)',
        background: 'var(--bg-surface)',
        boxShadow: isGraduated
          ? '4px 4px 0 rgba(34,197,94,0.3), 4px 4px 0 rgba(0,0,0,0.6)'
          : '4px 4px 0 rgba(0,0,0,0.8)',
        animationDelay: `${index * 60}ms`,
        animation: 'cardIn 0.3s ease both',
      }}
    >
      {/* Image area */}
      <div
        className="relative h-44 w-full overflow-hidden"
        style={{
          background: imageUrl ? 'var(--bg-elevated)' : tokenGradient(launch.name),
        }}
      >
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={launch.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
            onError={() => setImgError(true)}
          />
        )}

        {/* Bottom gradient overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#161412] via-transparent to-transparent"
        />

        {/* Graduation confetti burst */}
        {isGraduated && <GraduationBurst />}

        {/* Hover orange glow border */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none rounded-xl"
          style={{ boxShadow: 'inset 0 0 0 1px var(--orange-500)' }}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
          <span
            className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={isGraduated ? {
              background: 'rgba(34,197,94,0.2)',
              color: 'var(--green-500)',
              border: '1px solid rgba(34,197,94,0.4)',
            } : launch.status === 'ACTIVE' ? {
              background: 'rgba(34,197,94,0.12)',
              color: 'var(--green-500)',
              border: '1px solid rgba(34,197,94,0.3)',
            } : {
              background: 'rgba(0,0,0,0.4)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--bg-border)',
            }}
          >
            {isGraduated && <GraduationCap size={11} />}
            {isGraduated ? 'Graduated' : launch.status}
          </span>

          {isGraduated ? (
            <span className="badge-green flex items-center gap-1">
              <GraduationCap size={10} />
              GRADUATED
            </span>
          ) : live ? (
            <span className="badge-live">LIVE</span>
          ) : null}
        </div>

        {/* Symbol watermark */}
        {!imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-4xl font-display font-bold select-none"
              style={{ color: 'rgba(255,255,255,0.15)', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
            >
              {launch.symbol?.slice(0, 3)}
            </span>
          </div>
        )}
      </div>

      {/* Data */}
      <div className="p-4">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="font-display font-bold text-base leading-tight" style={{ color: 'var(--text-primary)' }}>
              {launch.name}
            </div>
            <div className="font-num text-xs mt-0.5" style={{ color: 'var(--orange-500)' }}>
              ${launch.symbol}
            </div>
          </div>
          <div className="text-right">
            <div className="font-num text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {launch.currentPrice ? formatBTC(launch.currentPrice) : '—'}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>BTC</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${progress}%`,
                background: progressColor(progress),
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {formatTokenAmount(launch.currentSupply || '0')}
            </span>
            <span className="font-num text-xs font-medium" style={{ color: progressColor(progress) }}>
              {progress.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Market cap + creator */}
        <div className="flex items-center justify-between">
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            MCap{' '}
            <span className="font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>
              {formatMarketCap(marketCapSats)}
            </span>
          </div>
          <span className="address-chip">{launch.creator}</span>
        </div>
      </div>
    </Link>
  );
}
