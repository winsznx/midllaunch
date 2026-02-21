'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useConnect, useAccounts, useDisconnect, useBalance } from '@midl/react';
import { AddressPurpose, addNetwork } from '@midl/core';
import { useTheme } from '@/lib/hooks/useTheme';
import { midlConfig } from '@/lib/midl/config';
import toast from 'react-hot-toast';

const NAV_LINKS = [
  { href: '/launches', label: 'Browse' },
  { href: '/create', label: 'Launch Token' },
  { href: '/launch-nft', label: 'Launch NFT' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/transactions', label: 'Txns' },
  { href: '/bot-demo', label: 'Bot' },
  { href: '/link-x', label: 'Link to X' },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [theme, toggleTheme] = useTheme();

  const { connectors, connect, status } = useConnect({
    purposes: [AddressPurpose.Payment, AddressPurpose.Ordinals],
  });
  const { accounts } = useAccounts();
  const { disconnect } = useDisconnect();
  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);
  const ordinalsAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Ordinals);
  const { balance } = useBalance({ address: paymentAccount?.address });
  const btcBalance = paymentAccount ? (balance / 1e8).toFixed(8).replace(/\.?0+$/, '') : null;
  const isConnecting = status === 'pending';

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  const handleConnect = async (connectorId: string) => {
    try {
      await connect({ id: connectorId });
      const connector = connectors.find(c => c.id === connectorId);
      if (connector?.metadata.name === 'Xverse') {
        try {
          await addNetwork(midlConfig, connectorId, {
            name: 'MIDL Regtest',
            network: 'regtest',
            rpcUrl: 'https://rpc.staging.midl.xyz',
            indexerUrl: 'https://api-regtest-midl.xverse.app/',
          });
        } catch { /* non-fatal */ }
      }
      toast.success('Wallet connected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect');
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 rounded-lg transition-colors hover:opacity-70"
        style={{ color: 'var(--text-secondary)' }}
        aria-label="Open menu"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] md:hidden">
          {/* Solid backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.75)' }}
            onClick={() => setOpen(false)}
          />

          {/* Slide-in panel — fully opaque, theme-aware */}
          <div
            className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-[320px] shadow-2xl overflow-hidden"
            style={{
              background: 'var(--bg-surface)',
              borderLeft: '1px solid var(--bg-border)',
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto',
            }}
          >
            {/* Header */}
            <div
              className="flex justify-between items-center p-4"
              style={{
                borderBottom: '1px solid var(--bg-border)',
                background: 'var(--bg-surface)',
              }}
            >
              <span className="font-display font-bold text-base">
                <span style={{ color: 'var(--orange-500)' }}>₿</span>{' '}
                <span style={{ color: 'var(--text-primary)' }}>MidlLaunch</span>
              </span>

              <div className="flex items-center gap-2">
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

                {/* Close */}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-md hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--text-secondary)' }}
                  aria-label="Close menu"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable body — wallet + nav together */}
            <div className="overflow-y-auto">

              {/* Wallet section */}
              <div
                className="p-4"
                style={{
                  borderBottom: '1px solid var(--bg-border)',
                }}
              >
                {paymentAccount ? (
                  <div className="space-y-2">
                    {/* BTC balance */}
                    <div
                      className="px-3 py-2.5 rounded-xl flex items-center justify-between"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--green-500)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>BTC Balance</span>
                      </div>
                      <span className="text-sm font-mono font-semibold" style={{ color: 'var(--orange-500)' }}>
                        {btcBalance ?? '—'} BTC
                      </span>
                    </div>

                    {/* Payment address */}
                    <div className="px-3 py-2 rounded-xl space-y-0.5" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Payment</div>
                      <div className="text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
                        {paymentAccount.address}
                      </div>
                    </div>

                    {/* Ordinals address */}
                    {ordinalsAccount && (
                      <div className="px-3 py-2 rounded-xl space-y-0.5" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Ordinals</div>
                        <div className="text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
                          {ordinalsAccount.address}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(paymentAccount.address);
                          toast.success('Copied');
                        }}
                        className="py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                        style={{
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--bg-border)',
                        }}
                      >
                        Copy Address
                      </button>
                      <button
                        onClick={() => { disconnect(); toast.success('Disconnected'); }}
                        className="py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                        style={{
                          background: 'rgba(239,68,68,0.08)',
                          color: 'var(--red-500)',
                          border: '1px solid rgba(239,68,68,0.2)',
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : connectors?.length === 1 ? (
                  <button
                    onClick={() => handleConnect(connectors[0].id)}
                    disabled={isConnecting}
                    className="btn btn-primary w-full text-sm"
                  >
                    {isConnecting ? 'Connecting…' : `Connect ${connectors[0].metadata.name}`}
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      Connect wallet
                    </p>
                    {connectors?.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleConnect(c.id)}
                        disabled={isConnecting}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                        style={{
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--bg-border)',
                        }}
                      >
                        {c.metadata.icon && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.metadata.icon} alt="" width={20} height={20} className="rounded-sm flex-shrink-0" />
                        )}
                        {c.metadata.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Nav links */}
              <nav className="flex flex-col gap-0.5 p-3">
                {NAV_LINKS.map(({ href, label }) => {
                  const active = pathname === href || (href !== '/' && pathname.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      className="px-4 py-3 rounded-xl text-sm font-medium transition-all"
                      style={{
                        color: active ? 'var(--orange-500)' : 'var(--text-secondary)',
                        background: active ? 'rgba(249,115,22,0.08)' : 'transparent',
                      }}
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>

            </div> {/* end scrollable body */}

            {/* Footer */}
            <div
              className="p-4 text-xs"
              style={{
                borderTop: '1px solid var(--bg-border)',
                color: 'var(--text-tertiary)',
              }}
            >
              Built on Midl Network
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
