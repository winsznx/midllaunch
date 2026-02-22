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
  { label: 'New', icon: <Sparkles size={13} />, sort: 'newest' },
  { label: 'Price ↑', icon: <TrendingUp size={13} />, sort: 'price_high' },
  { label: 'Price ↓', icon: <TrendingDown size={13} />, sort: 'price_low' },
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

  const imageUrl = slide.type === 'token'
    ? (slide.item.imageUrl || (slide.item.metadataUri ? ipfsUriToHttp(slide.item.metadataUri) : null))
    : (slide.item.imageUrl ?? null);

  const gradient = slide.type === 'token'
    ? tokenGradient(slide.item.name)
    : addressGradient(slide.item.contractAddress);

  const href = slide.type === 'token'
    ? `/launch/${slide.item.tokenAddress}`
    : `/nft/${slide.item.contractAddress}`;

  const name = slide.item.name;
  const symbol = slide.item.symbol;

  const description = slide.type === 'token'
    ? (slide.item.description ?? null)
    : (slide.item.description ?? null);

  const creator = slide.type === 'token'
    ? slide.item.creator
    : slide.item.creatorAddress;

  const priceLabel = slide.type === 'token' ? 'Price' : 'Mint';
  const priceValue = slide.type === 'token'
    ? (slide.item.currentPrice ? `${formatBTC(slide.item.currentPrice)} BTC` : '—')
    : (() => { const s = Number(slide.item.mintPrice); return s < 100_000 ? `${s} sats` : `${(s / 1e8).toFixed(5)} BTC`; })();

  const marketCapSats = slide.type === 'token'
    ? (slide.item.currentPrice && slide.item.currentSupply
      ? parseFloat(slide.item.currentPrice) * (Number(slide.item.currentSupply) / 1e18)
      : 0)
    : Number(slide.item.mintPrice) * slide.item.totalMinted;

  const progress = slide.type === 'token'
    ? (slide.item.currentSupply && slide.item.supplyCap
      ? Math.min(Number(BigInt(slide.item.currentSupply) * BigInt(10000) / BigInt(slide.item.supplyCap)) / 100, 100)
      : 0)
    : (slide.item.totalSupply > 0 ? Math.min(100, (slide.item.totalMinted / slide.item.totalSupply) * 100) : 0);

  const progressLabel = slide.type === 'token' ? 'Bonding curve' : 'Minted';

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--bg-border)',
        boxShadow: '4px 4px 0 rgba(0,0,0,0.85)',
      }}
    >
      <Link href={href} className="flex min-h-[220px] block">
        {/* Image panel */}
        <div
          className="relative flex-shrink-0"
          style={{ width: '44%', background: gradient }}
        >
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={name}
              fill
              className="object-cover"
              sizes="200px"
            />
          )}
          {/* Symbol badge */}
          <div className="absolute top-3 left-3">
            <span
              className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded"
              style={{
                background: 'rgba(0,0,0,0.65)',
                color: 'var(--orange-500)',
                border: '1px solid rgba(249,115,22,0.35)',
              }}
            >
              ${symbol}
            </span>
          </div>
          {/* Bottom gradient */}
          <div
            className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }}
          />
        </div>

        {/* Details panel */}
        <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
          <div className="space-y-1 min-w-0">
            <div
              className="font-display font-bold text-base leading-tight truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {name}
            </div>
            {description && (
              <p
                className="text-xs leading-relaxed"
                style={{
                  color: 'var(--text-tertiary)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {description}
              </p>
            )}
          </div>

          <div className="space-y-1.5 text-xs mt-3">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-tertiary)' }}>Created by</span>
              <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                {creator.slice(0, 8)}…
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-tertiary)' }}>{priceLabel}</span>
              <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                {priceValue}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-tertiary)' }}>Marketcap</span>
              <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatMarketCap(marketCapSats)}
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span style={{ color: 'var(--text-tertiary)' }}>{progressLabel}</span>
              <span className="font-mono" style={{ color: 'var(--orange-500)' }}>
                {progress.toFixed(1)}%
              </span>
            </div>
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{ background: 'var(--bg-border)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'var(--orange-500)' }}
              />
            </div>
          </div>
        </div>
      </Link>

      {/* Slide dots */}
      {slides.length > 1 && (
        <div
          className="flex items-center justify-center gap-1.5 py-3 border-t"
          style={{ borderColor: 'var(--bg-border)' }}
        >
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? '18px' : '6px',
                height: '6px',
                background: i === current ? 'var(--orange-500)' : 'var(--bg-border)',
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
      <div
        className="relative rounded-2xl overflow-hidden mb-10"
        style={{
          background: 'linear-gradient(135deg, #0d0b08 0%, #130f0a 40%, #0e0c14 70%, #0b0d12 100%)',
          border: '1px solid rgba(249,115,22,0.2)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset, 0 4px 48px rgba(0,0,0,0.5)',
        }}
      >
        {/* Background: large orange orb left */}
        <div className="absolute pointer-events-none" style={{
          top: '-40%', left: '-10%',
          width: '60%', height: '180%',
          background: 'radial-gradient(ellipse, rgba(249,115,22,0.13) 0%, transparent 65%)',
          filter: 'blur(32px)',
        }} />
        {/* Background: purple orb top-right */}
        <div className="absolute pointer-events-none" style={{
          top: '-30%', right: '5%',
          width: '45%', height: '120%',
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.1) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }} />
        {/* Background: blue orb bottom-right */}
        <div className="absolute pointer-events-none" style={{
          bottom: '-20%', right: '20%',
          width: '35%', height: '80%',
          background: 'radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 65%)',
          filter: 'blur(36px)',
        }} />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Inner padding */}
        <div className="relative px-7 pt-7 pb-7 lg:px-10 lg:pt-9 lg:pb-9">

          {/* Stats strip at top */}
          <div className="flex items-center gap-4 mb-7 overflow-x-auto scrollbar-none">
            {[
              { label: 'Network', value: 'Midl L2', accent: true },
              { label: 'Settlement', value: 'Bitcoin' },
              { label: 'Curve type', value: 'Linear' },
              { label: 'Order book', value: 'None' },
              { label: 'Custody', value: 'Non-custodial' },
            ].map(s => (
              <div
                key={s.label}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{
                  background: s.accent ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
                  border: s.accent ? '1px solid rgba(249,115,22,0.28)' : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</span>
                <span
                  className="text-[11px] font-mono font-semibold"
                  style={{ color: s.accent ? 'var(--orange-400)' : 'rgba(255,255,255,0.75)' }}
                >
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-center">
            {/* Left: copy + CTAs */}
            <div className="lg:col-span-3 flex flex-col">
              {/* Badge */}
              <div
                className="inline-flex items-center gap-2 text-[11px] font-semibold px-3 py-1 rounded-full mb-5 w-fit uppercase tracking-widest"
                style={{
                  background: 'rgba(249,115,22,0.15)',
                  color: 'var(--orange-400)',
                  border: '1px solid rgba(249,115,22,0.35)',
                  letterSpacing: '0.1em',
                }}
              >
                <Flame size={10} />
                {assetType === 'tokens' ? 'Bitcoin-Native Token Launchpad' : 'Bitcoin-Native NFT Launchpad'}
              </div>

              {/* Headline */}
              <h1
                className="font-display font-bold leading-[1.05] mb-4"
                style={{ fontSize: 'clamp(2rem,4.5vw,3.25rem)', color: '#f5f0e8' }}
              >
                {assetType === 'tokens' ? (
                  <>
                    Issue tokens.<br />
                    Trade the curve.{' '}
                    <span style={{
                      background: 'linear-gradient(90deg, #f97316, #fb923c, #fbbf24)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}>
                      Stack sats.
                    </span>
                  </>
                ) : (
                  <>
                    Deploy collections.<br />
                    Trade on-chain.{' '}
                    <span style={{
                      background: 'linear-gradient(90deg, #f97316, #fb923c, #fbbf24)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}>
                      Settle in BTC.
                    </span>
                  </>
                )}
              </h1>

              {/* Subtext */}
              <p className="text-sm mb-7 max-w-sm leading-relaxed" style={{ color: 'rgba(245,240,232,0.55)' }}>
                {assetType === 'tokens'
                  ? 'Bitcoin-native token markets on bonding curves. No order book. No AMM. Price determined entirely by supply.'
                  : 'Fixed-price NFT collections on Midl\u2019s Bitcoin execution layer. Mint on-chain, settlement finalised in BTC.'}
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href={assetType === 'tokens' ? '/create' : '/launch-nft'}
                  className="btn btn-primary flex items-center gap-2 text-sm px-5 py-2.5"
                >
                  <Rocket size={14} />
                  {assetType === 'tokens' ? 'Launch Token' : 'Launch NFT'}
                </Link>
                <button
                  onClick={() => document.getElementById('browse-grid')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-80"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    color: 'rgba(245,240,232,0.7)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  Browse All
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Feature tags */}
              <div className="flex flex-wrap gap-2 mt-6">
                {(assetType === 'tokens'
                  ? ['Bonding curve pricing', 'No pre-sale', 'Creator fees on-chain', 'Instant liquidity']
                  : ['Fixed-price minting', 'On-chain provenance', 'BTC settlement', 'EVM execution']
                ).map(tag => (
                  <span
                    key={tag}
                    className="text-[11px] px-2.5 py-1 rounded-md"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      color: 'rgba(245,240,232,0.45)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: carousel */}
            <div className="lg:col-span-2">
              {carouselSlides.length > 0
                ? <HeroCarousel slides={carouselSlides} />
                : (
                  <div
                    className="rounded-2xl h-64 flex flex-col items-center justify-center gap-3"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <Sparkles size={28} style={{ color: 'rgba(249,115,22,0.4)' }} />
                    <span className="text-sm" style={{ color: 'rgba(245,240,232,0.3)' }}>
                      Awaiting launches…
                    </span>
                  </div>
                )
              }
            </div>
          </div>
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
      <div
        id="browse-grid"
        className="rounded-2xl p-6 md:p-8"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
      >
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
              style={{ border: '1px dashed var(--bg-border)' }}
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
              style={{ border: '1px dashed var(--bg-border)' }}
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
