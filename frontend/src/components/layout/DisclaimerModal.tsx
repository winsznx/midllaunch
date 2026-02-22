'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const STORAGE_KEY = 'midl_disclaimer_accepted_v1';

const TRADING_ROUTE_PREFIXES = [
  '/launches',
  '/launch/',
  '/nft/',
  '/create',
  '/launch-nft',
  '/portfolio',
  '/transactions',
  '/my-tokens',
];

function isTradingRoute(pathname: string): boolean {
  return TRADING_ROUTE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix));
}

export function DisclaimerModal() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isTradingRoute(pathname)) return;
    try {
      const accepted = localStorage.getItem(STORAGE_KEY);
      if (!accepted) setVisible(true);
    } catch {
      // localStorage unavailable — do not block the user
    }
  }, [pathname]);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div className="flex min-h-full items-center justify-center px-4 py-12">
        <div
          className="w-full max-w-md rounded-2xl p-8"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}
        >
          {/* Title */}
          <div className="mb-6">
            <div
              className="text-[10px] font-mono font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-tertiary)' }}
            >
              MidlLaunch · Staging Network
            </div>
            <h2
              className="font-display font-bold text-xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Before You Continue
            </h2>
          </div>

          {/* Body */}
          <div className="mb-6 space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              MidlLaunch is a primary issuance platform built on Midl&apos;s execution layer.
            </p>

            <ul
              className="space-y-2 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {[
                'You sign Bitcoin transactions.',
                'Execution occurs in Midl\u2019s EVM layer.',
                'Final settlement requires Bitcoin confirmation.',
                'Purchases are final and may lose value.',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0"
                    style={{ background: 'var(--text-tertiary)' }}
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--text-tertiary)' }}
            >
              There are no guarantees of price performance or liquidity.
            </p>
          </div>

          {/* Divider */}
          <div className="mb-6 h-px" style={{ background: 'var(--bg-border)' }} />

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={accept}
              className="btn btn-primary w-full sm:w-auto text-sm"
            >
              I Understand
            </button>
            <Link
              href="/how-it-works"
              onClick={accept}
              className="text-sm transition-colors hover:underline"
              style={{ color: 'var(--text-tertiary)' }}
            >
              View How It Works
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
