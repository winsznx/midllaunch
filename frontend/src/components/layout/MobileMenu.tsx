'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/launches',     label: 'Browse'        },
  { href: '/create',       label: 'Launch Token'  },
  { href: '/launch-nft',   label: 'Launch NFT'    },
  { href: '/portfolio',    label: 'Portfolio'     },
  { href: '/transactions', label: 'Transactions'  },
  { href: '/bot-demo',     label: 'Bot Demo'      },
  { href: '/link-x',       label: 'Link to X'     },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

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

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setOpen(false)}
          />

          {/* Slide-in panel */}
          <div
            className="absolute right-0 top-0 bottom-0 w-72 flex flex-col p-6 gap-6"
            style={{
              background: 'var(--bg-glass)',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              borderLeft: 'var(--glass-border)',
            }}
          >
            {/* Panel header */}
            <div className="flex justify-between items-center">
              <span className="font-display font-bold text-lg">
                <span style={{ color: 'var(--orange-500)' }}>₿</span>{' '}
                <span style={{ color: 'var(--text-primary)' }}>MidlLaunch</span>
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:opacity-70 transition-opacity"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Close menu"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className="px-4 py-3 rounded-xl text-sm font-medium transition-all"
                    style={{
                      color: active ? 'var(--orange-500)' : 'var(--text-secondary)',
                      background: active ? 'var(--orange-50)' : 'transparent',
                    }}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Footer hint */}
            <div className="mt-auto text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Built on Midl Network
            </div>
          </div>
        </div>
      )}
    </>
  );
}
