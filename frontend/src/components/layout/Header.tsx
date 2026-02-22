'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useConnect, useAccounts, useDisconnect, useBalance } from '@midl/react';
import { AddressPurpose, addNetwork } from '@midl/core';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/lib/hooks/useTheme';
import { midlConfig } from '@/lib/midl/config';
import { MobileMenu } from './MobileMenu';
import { GlobalSearch } from './GlobalSearch';
import { useGlobalActivity } from '@/lib/hooks/useLaunches';
import toast from 'react-hot-toast';
import { Zap } from 'lucide-react';

function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const NAV_LINKS = [
  { href: '/launches', label: 'Browse' },
  { href: '/create', label: 'Launch Token' },
  { href: '/launch-nft', label: 'Launch NFT' },
  { href: '/my-tokens', label: 'My Tokens' },
  { href: '/referral', label: 'Referral' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/transactions', label: 'Txns' },
];

function ActivityTicker() {
  const { data } = useGlobalActivity(20);
  const events = data?.events ?? [];

  if (events.length === 0) return null;

  // Duplicate for seamless loop
  const items = [...events, ...events];

  return (
    <div
      className="w-full border-b overflow-hidden"
      style={{ borderColor: 'var(--bg-border)', background: 'transparent', height: '28px' }}
    >
      <div className="flex items-center h-full gap-2 px-3">
        <div className="flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--orange-500)' }}>
          <Zap size={10} />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Live</span>
        </div>
        <div className="w-px h-3 flex-shrink-0" style={{ background: 'var(--bg-border)' }} />

        {/* Scrolling ticker */}
        <div className="flex-1 overflow-hidden relative">
          <div
            className="flex gap-6 whitespace-nowrap"
            style={{ animation: 'ticker 30s linear infinite' }}
          >
            {items.map((event, i) => {
              const btcAmt = (Number(event.amountSats) / 1e8).toFixed(5).replace(/\.?0+$/, '');
              return (
                <Link
                  key={i}
                  href={`/launch/${event.launchAddress}`}
                  className="inline-flex items-center gap-1.5 text-[10px] font-mono hover:opacity-70 transition-opacity flex-shrink-0"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span style={{ color: 'var(--green-500)' }}>▲</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{event.tokenSymbol}</span>
                  <span>{btcAmt} BTC</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>by {event.buyerAddress.slice(0, 6)}…</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const [theme, toggleTheme] = useTheme();
  const { connectors, connect, status } = useConnect({
    purposes: [AddressPurpose.Payment, AddressPurpose.Ordinals],
  });
  const { accounts } = useAccounts();
  const { disconnect } = useDisconnect();
  const [showConnectors, setShowConnectors] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const connectorsRef = useRef<HTMLDivElement>(null);
  const walletMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (connectorsRef.current && !connectorsRef.current.contains(e.target as Node)) {
        setShowConnectors(false);
      }
      if (walletMenuRef.current && !walletMenuRef.current.contains(e.target as Node)) {
        setShowWalletMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleConnect = async (connectorId: string) => {
    setShowConnectors(false);
    try {
      await connect({ id: connectorId });

      const connector = connectors.find(c => c.id === connectorId);
      if (connector?.metadata.name === 'Xverse') {
        try {
          await addNetwork(midlConfig, connectorId, {
            name: 'MIDL Regtest',
            network: 'regtest',
            rpcUrl: 'https://mempool.staging.midl.xyz/api',
            indexerUrl: 'https://api-regtest-midl.xverse.app/',
          });
        } catch {
          // Non-fatal: Xverse may reject if network already registered
        }
      }
      toast.success('Wallet connected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect wallet');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast.success('Wallet disconnected');
  };

  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);
  const ordinalsAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Ordinals);
  const { balance, refetch: refetchBalance } = useBalance({ address: paymentAccount?.address });
  const btcBalance = paymentAccount ? (balance / 1e8).toFixed(8).replace(/\.?0+$/, '') : null;

  useEffect(() => {
    const handler = () => { refetchBalance(); };
    window.addEventListener('midl:tx-success', handler);
    return () => window.removeEventListener('midl:tx-success', handler);
  }, [refetchBalance]);

  const isConnecting = status === 'pending';

  return (
    <header className="sticky top-4 z-50 w-full px-4 md:px-6 mb-8 mt-2 transition-all duration-300">
      <div
        className="mx-auto max-w-6xl w-full flex flex-col overflow-hidden rounded-2xl shadow-xl backdrop-blur-md"
        style={{
          background: 'var(--bg-glass)',
          border: '1px solid var(--bg-border)',
        }}
      >
        {/* Activity ticker */}
        <ActivityTicker />

        {/* Main nav row */}
        <div className="w-full flex h-14 items-center justify-between px-4 md:px-6">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 select-none flex-shrink-0">
              <span className="font-display font-bold text-lg leading-none text-gradient">
                MidlLaunch
              </span>
            </Link>

            {/* Nav — scrollable on md */}
            <nav className="hidden md:flex gap-0.5 overflow-x-auto scrollbar-none">
              {NAV_LINKS.map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                    style={{
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: active ? 'var(--bg-elevated)' : 'transparent',
                    }}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Mobile hamburger */}
          <MobileMenu />

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {/* Global search */}
            <GlobalSearch />

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}
            >
              {theme === 'dark' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {!paymentAccount ? (
              <div className="relative">
                {connectors.length === 1 ? (
                  <button
                    onClick={() => handleConnect(connectors[0].id)}
                    disabled={isConnecting}
                    className="btn btn-primary text-sm relative"
                    style={{ minWidth: '120px' }}
                  >
                    {!isConnecting && (
                      <span
                        className="absolute inset-0 rounded-lg pointer-events-none"
                        style={{
                          animation: 'ring 2.5s cubic-bezier(0.4,0,0.6,1) infinite',
                          border: '2px solid var(--orange-500)',
                          opacity: 0,
                        }}
                      />
                    )}
                    {isConnecting ? 'Connecting…' : `Connect ${connectors[0].metadata.name}`}
                  </button>
                ) : (
                  <div ref={connectorsRef}>
                    <button
                      onClick={() => setShowConnectors(v => !v)}
                      disabled={isConnecting}
                      className="btn btn-primary text-sm relative"
                      style={{ minWidth: '120px' }}
                    >
                      {!isConnecting && (
                        <span
                          className="absolute inset-0 rounded-lg pointer-events-none"
                          style={{
                            animation: 'ring 2.5s cubic-bezier(0.4,0,0.6,1) infinite',
                            border: '2px solid var(--orange-500)',
                            opacity: 0,
                          }}
                        />
                      )}
                      {isConnecting ? 'Connecting…' : 'Connect Wallet'}
                    </button>

                    {showConnectors && (
                      <div
                        className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden shadow-lg z-10 min-w-[180px]"
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--bg-border)',
                        }}
                      >
                        <div className="px-4 py-2 border-b text-xs font-medium" style={{ borderColor: 'var(--bg-border)', color: 'var(--text-tertiary)' }}>
                          Select wallet
                        </div>
                        {connectors.map(c => (
                          <button
                            key={c.id}
                            onClick={() => handleConnect(c.id)}
                            className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5 flex items-center gap-2.5"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {c.metadata.icon && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.metadata.icon} alt="" width={18} height={18} className="rounded-sm flex-shrink-0" />
                            )}
                            {c.metadata.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div ref={walletMenuRef} className="flex items-center gap-2 relative">
                <button
                  onClick={() => setShowWalletMenu(v => !v)}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'var(--green-500)' }}
                  />
                  <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {formatAddress(paymentAccount.address)}
                  </span>
                  {btcBalance !== null && (
                    <span className="text-xs font-mono font-medium" style={{ color: 'var(--orange-500)' }}>
                      {btcBalance} BTC
                    </span>
                  )}
                </button>

                {showWalletMenu && (
                  <div
                    className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden shadow-lg z-10"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', minWidth: '260px' }}
                  >
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--bg-border)' }}>
                      <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>BTC Balance</div>
                      <div className="text-base font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {btcBalance ?? '—'} BTC
                      </div>
                    </div>

                    <div className="px-4 py-3 border-b space-y-2.5" style={{ borderColor: 'var(--bg-border)' }}>
                      <div>
                        <div className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Payment</div>
                        <div className="text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
                          {paymentAccount.address}
                        </div>
                      </div>
                      {ordinalsAccount && (
                        <div>
                          <div className="text-xs mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Ordinals</div>
                          <div className="text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
                            {ordinalsAccount.address}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(paymentAccount.address);
                        toast.success('Address copied');
                        setShowWalletMenu(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Copy Payment Address
                    </button>
                    <Link
                      href="/my-tokens"
                      onClick={() => setShowWalletMenu(false)}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      My Tokens
                    </Link>
                    <Link
                      href="/link-x"
                      onClick={() => setShowWalletMenu(false)}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5 flex items-center gap-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      Link to X
                    </Link>
                    <button
                      onClick={() => { setShowWalletMenu(false); handleDisconnect(); }}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
