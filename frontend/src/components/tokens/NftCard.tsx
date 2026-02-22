'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ipfsUriToHttp } from '@/lib/ipfs/upload';

interface NftLaunch {
  contractAddress: string;
  name: string;
  symbol: string;
  totalSupply: number;
  mintPrice: bigint | string | number;
  maxPerWallet: number;
  imageUrl?: string | null;
  description?: string | null;
  totalMinted: number;
  isFinalized: boolean;
  creatorAddress: string;
  createdAt: string | Date;
}

function satoshisToDisplay(sats: bigint | string | number): string {
  const n = BigInt(sats.toString());
  if (n < BigInt(100_000)) return `${n.toString()} sats`;
  return `${(Number(n) / 1e8).toFixed(5)} BTC`;
}

function formatMarketCap(sats: number): string {
  if (sats === 0) return '—';
  const btc = sats / 1e8;
  if (btc >= 1) return `${btc.toFixed(2)} BTC`;
  if (btc >= 0.001) return `${btc.toFixed(4)} BTC`;
  return `${Math.round(sats).toLocaleString()} sats`;
}

function addressGradient(addr: string): string {
  const h = Array.from(addr).reduce((acc, c) => acc ^ c.charCodeAt(0), 0);
  const h2 = (h * 137) % 360;
  return `radial-gradient(ellipse, hsl(${h % 360},60%,35%), hsl(${h2},50%,15%))`;
}

export function NftCard({ launch }: { launch: NftLaunch }) {
  const mintedPct = launch.totalSupply > 0
    ? Math.min(100, (launch.totalMinted / launch.totalSupply) * 100)
    : 0;
  const isSoldOut = launch.isFinalized || launch.totalMinted >= launch.totalSupply;

  const marketCapSats = Number(launch.mintPrice.toString()) * launch.totalMinted;

  return (
    <Link
      href={`/nft/${launch.contractAddress}`}
      className="token-card block transition-all duration-200 hover:-translate-y-0.5"
      style={{ boxShadow: '4px 4px 0 rgba(0,0,0,0.8)' }}
    >
      {/* Image area */}
      <div
        className="relative overflow-hidden"
        style={{
          height: 160,
          background: launch.imageUrl ? 'transparent' : addressGradient(launch.contractAddress),
        }}
      >
        {launch.imageUrl && (
          <Image
            src={launch.imageUrl.startsWith('http') ? launch.imageUrl : ipfsUriToHttp(launch.imageUrl)}
            alt={launch.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
        )}
        {/* Type badge */}
        <div className="absolute top-3 left-3">
          <span className="badge-orange text-xs">NFT</span>
        </div>
        {/* Sold out / mint now badge */}
        {isSoldOut ? (
          <div className="absolute top-3 right-3">
            <span className="font-mono text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--bg-glass)', color: 'var(--text-tertiary)', border: 'var(--glass-border)' }}>
              SOLD OUT
            </span>
          </div>
        ) : (
          <div className="absolute top-3 right-3">
            <span className="badge-live text-xs">MINT</span>
          </div>
        )}
        {/* Bottom gradient overlay */}
        <div
          className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
          style={{ background: 'linear-gradient(to top, var(--bg-surface), transparent)' }}
        />
      </div>

      {/* Card body */}
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {launch.name}
            </div>
            <div className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {launch.symbol} · {launch.totalSupply} items
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-mono text-sm font-bold" style={{ color: 'var(--orange-500)' }}>
              {satoshisToDisplay(launch.mintPrice)}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>mint price</div>
          </div>
        </div>

        <ProgressBar value={launch.totalMinted} max={launch.totalSupply} />

        <div className="flex justify-between text-xs">
          <span style={{ color: 'var(--text-tertiary)' }}>{launch.totalMinted} minted · {mintedPct.toFixed(1)}%</span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            MCap <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{formatMarketCap(marketCapSats)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function NftCardPlaceholder() {
  return (
    <div className="token-card overflow-hidden relative" style={{ minHeight: 280 }}>
      <div className="h-40 w-full" style={{ background: 'var(--bg-elevated)' }} />
      <div className="p-4 space-y-3">
        <div className="h-4 rounded" style={{ background: 'var(--bg-elevated)', width: '60%' }} />
        <div className="h-3 rounded" style={{ background: 'var(--bg-elevated)', width: '80%' }} />
        <div className="h-1 rounded-full" style={{ background: 'var(--bg-elevated)', width: '100%' }} />
      </div>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: 'rgba(10,9,8,0.5)', backdropFilter: 'blur(2px)' }}
      >
        <span
          className="font-mono font-bold text-2xl tracking-widest"
          style={{ color: 'var(--orange-500)', opacity: 0.8 }}
        >
          SOON
        </span>
      </div>
    </div>
  );
}
