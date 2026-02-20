'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useConnect, useAccounts, useDisconnect } from '@midl/react';
import { AddressPurpose, addNetwork } from '@midl/core';
import { useState } from 'react';
import { useTheme } from '@/lib/hooks/useTheme';
import { midlConfig } from '@/lib/midl/config';
import { MobileMenu } from './MobileMenu';
import { GlobalSearch } from './GlobalSearch';
import toast from 'react-hot-toast';

function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const NAV_LINKS = [
  { href: '/launches',     label: 'Browse'       },
  { href: '/create',       label: 'Launch Token' },
  { href: '/launch-nft',   label: 'Launch NFT'   },
  { href: '/portfolio',    label: 'Portfolio'    },
  { href: '/transactions', label: 'Txns'         },
  { href: '/bot-demo',     label: 'Bot'          },
];

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

  const handleConnect = async (connectorId: string) => {
    setShowConnectors(false);
    try {
      await connect({ id: connectorId });

      // Register MIDL regtest network with Xverse so it uses the correct UTXO indexer.
      // Without this, Xverse's internal indexer fails to find UTXOs on regtest.
      const connector = connectors.find(c => c.id === connectorId);
      if (connector?.metadata.name === 'Xverse') {
        try {
          await addNetwork(midlConfig, connectorId, {
            name: 'MIDL Regtest',
            network: 'regtest',
            rpcUrl: 'https://rpc.staging.midl.xyz',
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
  const isConnecting = status === 'pending';

  return (
    <header
      className="sticky top-0 z-50 w-full border-b backdrop-blur-md"
      style={{
        borderColor: 'var(--bg-border)',
        background: 'rgba(13,12,11,0.85)',
      }}
    >
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 select-none">
            <span
              className="font-display font-bold text-lg leading-none text-gradient"
            >
              MidlLaunch
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
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

          {/* Theme toggle — sun/moon */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}
          >
            {theme === 'dark' ? (
              /* Sun */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              /* Moon */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {!paymentAccount ? (
            <div className="relative">
              {connectors.length === 1 ? (
                /* Single connector — direct button with pulse ring */
                <button
                  onClick={() => handleConnect(connectors[0].id)}
                  disabled={isConnecting}
                  className="btn btn-primary text-sm relative"
                  style={{ minWidth: '120px' }}
                >
                  {/* Pulse ring when not connecting */}
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
                /* Multiple connectors — dropdown */
                <>
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
                      className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden shadow-lg z-10 min-w-full"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--bg-border)',
                      }}
                    >
                      {connectors.map(c => (
                        <button
                          key={c.id}
                          onClick={() => handleConnect(c.id)}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {c.metadata.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 relative">
              {/* Address chip — click to open wallet menu */}
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
                <span
                  className="text-xs font-mono"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {formatAddress(paymentAccount.address)}
                </span>
              </button>

              {showWalletMenu && (
                <div
                  className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden shadow-lg z-10 min-w-max"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
                >
                  <Link
                    href="/link-x"
                    onClick={() => setShowWalletMenu(false)}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5 flex items-center gap-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span>🔗</span> Link to X
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
    </header>
  );
}

