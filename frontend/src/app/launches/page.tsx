'use client';

import { useState, useEffect } from 'react';
import { useLaunches, useNftLaunches } from '@/lib/hooks/useLaunches';
import { TokenCard } from '@/components/ui/TokenCard';
import { NftCard } from '@/components/tokens/NftCard';
import Link from 'next/link';
import type { LaunchStatus } from '@/types';
import { TokenCardSkeleton } from '@/components/ui/Skeletons';

type SortOption = 'newest' | 'price_low' | 'price_high' | 'trending' | 'near_cap';
type AssetType = 'tokens' | 'nfts';

const TABS: { label: string; icon: string; sort: SortOption; status?: LaunchStatus } [] = [
  { label: 'Trending',  icon: '🔥', sort: 'trending'   },
  { label: 'New',       icon: '🆕', sort: 'newest'     },
  { label: 'Price ↑',  icon: '📈', sort: 'price_high' },
  { label: 'Price ↓',  icon: '📉', sort: 'price_low'  },
  { label: 'Near Cap', icon: '🎓', sort: 'near_cap', status: 'ACTIVE' },
];

export default function LaunchesPage() {
  const [assetType, setAssetType] = useState<AssetType>('tokens');
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');
  const [devBuyPending, setDevBuyPending] = useState<{ btcAmount: string } | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('pendingDevBuy');
      if (!stored) return;
      const parsed = JSON.parse(stored) as { btcAmount: string; at: number };
      if (Date.now() - parsed.at < 5 * 60 * 1000) {
        setDevBuyPending({ btcAmount: parsed.btcAmount });
      }
    } catch {
      // ignore
    }
  }, []);

  const tab = TABS[activeTab];

  const { data, isLoading, error } = useLaunches({
    status: tab.status,
    sortBy: tab.sort,
    limit: 60,
  });

  const { data: nftData, isLoading: nftLoading } = useNftLaunches({ limit: 60 });

  const launches = data?.launches.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.name.toLowerCase().includes(q) || l.symbol.toLowerCase().includes(q);
  }) ?? [];

  const nfts = nftData?.launches.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.name.toLowerCase().includes(q) || l.symbol.toLowerCase().includes(q);
  }) ?? [];

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1
            className="font-display font-bold mb-1"
            style={{ fontSize: '2rem', color: 'var(--text-primary)' }}
          >
            Browse
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {assetType === 'tokens' ? `${data?.total ?? '—'} token launches` : `${nftData?.total ?? '—'} NFT collections`} · Midl Staging Network
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or ticker…"
            className="input w-full"
            style={{ paddingLeft: '2.25rem' }}
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: 'var(--text-tertiary)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Asset type switcher */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
      >
        {(['tokens', 'nfts'] as AssetType[]).map(type => (
          <button
            key={type}
            onClick={() => { setAssetType(type); setSearch(''); }}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: assetType === type ? 'var(--orange-500)' : 'transparent',
              color: assetType === type ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {type === 'tokens' ? '🪙 Tokens' : '🖼 NFTs'}
          </button>
        ))}
      </div>

      {/* Sort tabs (tokens only) */}
      {assetType === 'tokens' && (
        <div
          className="flex gap-1 p-1 rounded-xl mb-8 w-fit overflow-x-auto"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
        >
          {TABS.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setActiveTab(i)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: activeTab === i ? 'var(--bg-elevated)' : 'transparent',
                color: activeTab === i ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Dev buy pending banner */}
      {devBuyPending && (
        <div
          className="rounded-xl p-4 mb-6 flex items-center justify-between gap-4"
          style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🎯</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--orange-500)' }}>
                Launch submitted! First buy pending
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Once your token appears below, click it and place your {devBuyPending.btcAmount} BTC first buy.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setDevBuyPending(null); sessionStorage.removeItem('pendingDevBuy'); }}
            className="flex-shrink-0 text-xs"
            style={{ color: 'var(--text-tertiary)' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-xl p-4 mb-6 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red-500)' }}
        >
          {error instanceof Error ? error.message : 'Failed to load launches'}
        </div>
      )}

      {/* Grid */}
      {assetType === 'tokens' ? (
        isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <TokenCardSkeleton key={i} />
            ))}
          </div>
        ) : launches.length > 0 ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {launches.map((launch, i) => (
                <TokenCard key={launch.id} launch={launch} index={i} />
              ))}
            </div>
            <p className="mt-8 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Showing {launches.length} of {data?.total ?? 0}
            </p>
          </>
        ) : (
          <div
            className="rounded-xl p-16 text-center"
            style={{ background: 'var(--bg-surface)', border: '1px dashed var(--bg-border)' }}
          >
            <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {search ? `No results for "${search}"` : 'No launches yet'}
            </p>
            {!search && (
              <Link href="/create" className="btn btn-primary text-sm">
                Create First Launch
              </Link>
            )}
          </div>
        )
      ) : (
        nftLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <TokenCardSkeleton key={i} />
            ))}
          </div>
        ) : nfts.length > 0 ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {nfts.map(nft => (
                <NftCard key={nft.id} launch={nft} />
              ))}
            </div>
            <p className="mt-8 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Showing {nfts.length} of {nftData?.total ?? 0}
            </p>
          </>
        ) : (
          <div
            className="rounded-xl p-16 text-center"
            style={{ background: 'var(--bg-surface)', border: '1px dashed var(--bg-border)' }}
          >
            <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {search ? `No results for "${search}"` : 'No NFT collections yet'}
            </p>
            {!search && (
              <Link href="/launch-nft" className="btn btn-primary text-sm">
                Launch NFT Collection
              </Link>
            )}
          </div>
        )
      )}
    </div>
  );
}
