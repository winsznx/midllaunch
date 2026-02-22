'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLaunches, useNftLaunches } from '@/lib/hooks/useLaunches';
import { TokenCard } from '@/components/ui/TokenCard';
import { NftCard } from '@/components/tokens/NftCard';
import Link from 'next/link';
import Image from 'next/image';
import type { LaunchStatus, Launch, NftLaunchSummary } from '@/types';
import { TokenCardSkeleton } from '@/components/ui/Skeletons';
import {
  Flame, Sparkles, TrendingUp, TrendingDown, Trophy,
  Coins, ImageIcon, X, Rocket, Search, ChevronRight,
  Target,
} from 'lucide-react';
import { ipfsUriToHttp } from '@/lib/ipfs/upload';
import { formatBTC } from '@/lib/wallet';

type SortOption = 'newest' | 'price_low' | 'price_high' | 'trending' | 'near_cap';
type AssetType = 'tokens' | 'nfts';

const TABS: { label: string; icon: React.ReactNode; sort: SortOption; status?: LaunchStatus }[] = [
  { label: 'Trending', icon: <Flame size={13} />, sort: 'trending' },
  { label: 'New',      icon: <Sparkles size={13} />, sort: 'newest' },
  { label: 'Price ↑',  icon: <TrendingUp size={13} />, sort: 'price_high' },
  { label: 'Price ↓',  icon: <TrendingDown size={13} />, sort: 'price_low' },
  { label: 'Near Cap', icon: <Trophy size={13} />, sort: 'near_cap', status: 'ACTIVE' },
];

function tokenGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40 + Math.abs(hash >> 8) % 80) % 360;
  return `radial-gradient(ellipse at 30% 30%, hsl(${h1},70%,35%), hsl(${h2},60%,20%))`;
}

function addressGradient(addr: string): string {
  const h = Array.from(addr).reduce((acc, c) => acc ^ c.charCodeAt(0), 0);
  const h2 = (h * 137) % 360;
  return `radial-gradient(ellipse, hsl(${h % 360},60%,35%), hsl(${h2},50%,15%))`;
}

function formatMarketCap(sats: number): string {
  if (sats === 0) return '—';
  const btc = sats / 1e8;
  if (btc >= 1) return `${btc.toFixed(2)} BTC`;
  if (btc >= 0.001) return `${btc.toFixed(4)} BTC`;
  return `${Math.round(sats).toLocaleString()} sats`;
}

interface TokenSlide {
  type: 'token';
  item: Launch;
}
interface NftSlide {
  type: 'nft';
  item: NftLaunchSummary;
}
type CarouselSlide = TokenSlide | NftSlide;

function HeroCarousel({ slides }: { slides: CarouselSlide[] }) {
  const [current, setCurrent] = useState(0);

  const advance = useCallback(() => {
    setCurrent(c => (c + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(advance, 4000);
    return () => clearInterval(id);
  }, [advance, slides.length]);

  if (slides.length === 0) return null;

  const slide = slides[current];

  const getImageUrl = () => {
    if (slide.type === 'token') {
      return slide.item.imageUrl || (slide.item.metadataUri ? ipfsUriToHttp(slide.item.metadataUri) : null);
    }
    return slide.item.imageUrl ?? null;
  };

  const getGradient = () => {
    if (slide.type === 'token') return tokenGradient(slide.item.name);
    return addressGradient(slide.item.contractAddress);
  };

  const getHref = () => {
    if (slide.type === 'token') return `/launch/${slide.item.tokenAddress}`;
    return `/nft/${slide.item.contractAddress}`;
  };

  const getPrice = () => {
    if (slide.type === 'token') return slide.item.currentPrice ? `${formatBTC(slide.item.currentPrice)} BTC` : '—';
    const sats = Number(slide.item.mintPrice);
    if (sats < 100_000) return `${sats} sats`;
    return `${(sats / 1e8).toFixed(5)} BTC`;
  };

  const getMarketCap = () => {
    if (slide.type === 'token') {
      const sats = slide.item.currentPrice && slide.item.currentSupply
        ? parseFloat(slide.item.currentPrice) * (Number(slide.item.currentSupply) / 1e18)
        : 0;
      return formatMarketCap(sats);
    }
    const sats = Number(slide.item.mintPrice) * slide.item.totalMinted;
    return formatMarketCap(sats);
  };

  const getProgress = () => {
    if (slide.type === 'token') {
      if (!slide.item.currentSupply || !slide.item.supplyCap) return 0;
      return Math.min(Number(BigInt(slide.item.currentSupply) * BigInt(10000) / BigInt(slide.item.supplyCap)) / 100, 100);
    }
    return slide.item.totalSupply > 0 ? Math.min(100, (slide.item.totalMinted / slide.item.totalSupply) * 100) : 0;
  };

  const imageUrl = getImageUrl();
  const progress = getProgress();

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ border: '1px solid var(--bg-border)', boxShadow: '4px 4px 0 rgba(0,0,0,0.8)' }}>
      {/* Background */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{ background: getGradient() }}
      />
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={slide.item.name}
          fill
          className="object-cover opacity-40"
          sizes="400px"
        />
      )}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)' }} />

      {/* Content */}
      <Link href={getHref()} className="relative block p-5 h-52">
        <div className="absolute top-4 right-4">
          <span
            className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)', color: 'var(--orange-500)', border: '1px solid rgba(249,115,22,0.4)' }}
          >
            {slide.type === 'token' ? slide.item.symbol : slide.item.symbol}
          </span>
        </div>

        <div className="absolute bottom-4 left-5 right-5">
          <div className="font-display font-bold text-lg text-white leading-tight mb-1 truncate">
            {slide.item.name}
          </div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {slide.type === 'token' ? 'Price' : 'Mint'}: {getPrice()}
            </span>
            <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.7)' }}>
              MCap: {getMarketCap()}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'var(--orange-500)' }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {slide.type === 'token' ? 'Bonding curve' : 'Minted'}
            </span>
            <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {progress.toFixed(1)}%
            </span>
          </div>
        </div>
      </Link>

      {/* Slide dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? '16px' : '6px',
                height: '6px',
                background: i === current ? 'var(--orange-500)' : 'rgba(255,255,255,0.4)',
              }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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

  const { data, isLoading } = useLaunches({
    status: tab.status,
    sortBy: tab.sort,
    limit: 60,
  });

  const { data: trendingData } = useLaunches({ sortBy: 'trending', limit: 3 });
  const { data: nftData, isLoading: nftLoading } = useNftLaunches({ limit: 60 });
  const { data: topNftData } = useNftLaunches({ sortBy: 'newest', limit: 3 });

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

  // Build carousel slides
  const carouselSlides: CarouselSlide[] = assetType === 'tokens'
    ? (trendingData?.launches.slice(0, 3) ?? []).map(item => ({ type: 'token', item }))
    : (topNftData?.launches.slice(0, 3) ?? []).map(item => ({ type: 'nft', item }));

  return (
    <div className="container mx-auto px-4 py-8">

      {/* ── Hero Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-10">
        {/* Left: copy + CTAs */}
        <div className="lg:col-span-3 flex flex-col justify-center">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full mb-4 w-fit"
            style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--orange-500)', border: '1px solid rgba(249,115,22,0.3)' }}
          >
            <Flame size={11} />
            Bitcoin-Native Launchpad
          </div>
          <h1
            className="font-display font-bold leading-tight mb-3"
            style={{ fontSize: 'clamp(1.75rem,4vw,2.75rem)', color: 'var(--text-primary)' }}
          >
            Create, Trade, and Dominate the{' '}
            <span
              className="text-gradient"
            >
              {assetType === 'tokens' ? 'Memecoin Universe' : 'NFT Universe'}
            </span>
          </h1>
          <p className="text-sm mb-6 max-w-md" style={{ color: 'var(--text-secondary)' }}>
            {assetType === 'tokens'
              ? 'The Bitcoin-native launchpad for the next generation of memecoin traders. Launch, trade, and earn—secured by BTC.'
              : 'Mint and collect the hottest NFT collections on the Bitcoin network. Own, trade, and build your collection.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={assetType === 'tokens' ? '/create' : '/launch-nft'}
              className="btn btn-primary flex items-center gap-2 text-sm"
            >
              <Rocket size={14} />
              {assetType === 'tokens' ? 'Launch Token' : 'Launch NFT'}
            </Link>
            <button
              onClick={() => document.getElementById('browse-grid')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--bg-border)' }}
            >
              Browse All
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Right: carousel */}
        <div className="lg:col-span-2">
          {carouselSlides.length > 0
            ? <HeroCarousel slides={carouselSlides} />
            : (
              <div
                className="rounded-2xl h-52 flex items-center justify-center"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
              >
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading top performers…</span>
              </div>
            )
          }
        </div>
      </div>

      {/* ── Asset type switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div
          className="flex gap-1 p-1 rounded-xl w-fit"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
        >
          {(['tokens', 'nfts'] as AssetType[]).map(type => (
            <button
              key={type}
              onClick={() => { setAssetType(type); setSearch(''); }}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: assetType === type ? 'var(--orange-500)' : 'transparent',
                color: assetType === type ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {type === 'tokens' ? <Coins size={14} /> : <ImageIcon size={14} />}
              {type === 'tokens' ? 'Tokens' : 'NFTs'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-tertiary)' }}
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or ticker…"
            className="input w-full"
            style={{ paddingLeft: '2.25rem' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Sort tabs (tokens only) ── */}
      {assetType === 'tokens' && (
        <div className="w-full overflow-x-auto mb-8">
          <div
            className="flex gap-1 p-1 rounded-xl w-fit min-w-full sm:min-w-0"
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
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats bar ── */}
      <div className="flex items-center gap-2 mb-6">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {assetType === 'tokens'
            ? `${data?.total ?? '—'} token launches`
            : `${nftData?.total ?? '—'} NFT collections`}{' '}
          · Midl Staging Network
        </p>
      </div>

      {/* ── Dev buy pending banner ── */}
      {devBuyPending && (
        <div
          className="rounded-xl p-4 mb-6 flex items-center justify-between gap-4"
          style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)' }}
        >
          <div className="flex items-center gap-3">
            <Target size={18} style={{ color: 'var(--orange-500)', flexShrink: 0 }} />
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
            className="flex-shrink-0 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Grid ── */}
      <div id="browse-grid">
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
    </div>
  );
}
