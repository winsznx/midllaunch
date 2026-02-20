'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSearch } from '@/lib/hooks/useLaunches';
import { formatBTC } from '@/lib/wallet';
import { ipfsUriToHttp } from '@/lib/ipfs/upload';
import Image from 'next/image';

function nftGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `radial-gradient(ellipse, hsl(${Math.abs(h) % 360},60%,30%), hsl(${(Math.abs(h) + 90) % 360},50%,15%))`;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced query sent to the hook
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useSearch(debouncedQuery);
  const results = data?.launches ?? [];

  // Open on ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const navigate = useCallback((address: string) => {
    setOpen(false);
    router.push(`/launch/${address}`);
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      navigate(results[activeIndex].tokenAddress);
    }
  };

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative">
      {/* Search trigger / input */}
      {open ? (
        <div
          className="flex items-center gap-2 rounded-lg px-3"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--orange-500)',
            height: '36px',
            width: '220px',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(-1); }}
            onKeyDown={handleKeyDown}
            placeholder="Search tokens…"
            className="bg-transparent outline-none text-sm flex-1 min-w-0"
            style={{ color: 'var(--text-primary)' }}
          />
          {isFetching && (
            <span
              className="w-3 h-3 rounded-full border-2 animate-spin flex-shrink-0"
              style={{ borderColor: 'var(--orange-500)', borderTopColor: 'transparent' }}
            />
          )}
          <kbd
            className="text-[10px] font-mono px-1 rounded flex-shrink-0"
            style={{ background: 'var(--bg-border)', color: 'var(--text-tertiary)' }}
          >
            ESC
          </kbd>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Search (⌘K)"
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      )}

      {/* Results dropdown */}
      {showDropdown && (
        <div
          className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden shadow-2xl z-[60]"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)',
            width: '320px',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {results.length === 0 && !isFetching ? (
            <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((launch, i) => {
              const imageUrl = launch.metadataUri ? ipfsUriToHttp(launch.metadataUri) : null;
              return (
                <button
                  key={launch.tokenAddress}
                  onClick={() => navigate(launch.tokenAddress)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors"
                  style={{
                    background: i === activeIndex ? 'var(--bg-border)' : 'transparent',
                    borderBottom: i < results.length - 1 ? '1px solid var(--bg-border)' : 'none',
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {/* Thumbnail */}
                  <div
                    className="w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden relative"
                    style={{ background: imageUrl ? 'var(--bg-surface)' : nftGradient(launch.name) }}
                  >
                    {imageUrl && (
                      <Image src={imageUrl} alt={launch.name} fill sizes="36px" className="object-cover" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {launch.name}
                    </div>
                    <div className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                      ${launch.symbol}
                    </div>
                  </div>

                  {/* Right: price + status */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-mono font-medium" style={{ color: 'var(--orange-500)' }}>
                      {launch.currentPrice ? formatBTC(launch.currentPrice) : '—'} BTC
                    </div>
                    <div
                      className="text-[10px] font-mono px-1 rounded mt-0.5"
                      style={{
                        background: launch.status === 'ACTIVE' ? 'rgba(34,197,94,0.12)' : 'rgba(0,0,0,0.3)',
                        color: launch.status === 'ACTIVE' ? 'var(--green-500)' : 'var(--text-tertiary)',
                        display: 'inline-block',
                      }}
                    >
                      {launch.status}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
