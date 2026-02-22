import Link from 'next/link';

const LEGAL_LINKS = [
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Risk Disclosure', href: '/risk-disclosure' },
];

const NETWORK_LINKS = [
  { label: 'Mempool Explorer', href: 'https://mempool.staging.midl.xyz', external: true },
  { label: 'Blockscout Explorer', href: 'https://blockscout.staging.midl.xyz', external: true },
  { label: 'RPC Endpoint', href: 'https://rpc.staging.midl.xyz', external: true },
];

const PROTOCOL_LINKS = [
  { label: 'Architecture Overview', href: '/how-it-works' },
  { label: 'Settlement Model', href: '/how-it-works#settlement' },
  { label: 'Bonding Curve Model', href: '/how-it-works#bonding-curve' },
  { label: 'Vision & Roadmap', href: 'https://github.com/winsznx/midllaunch/blob/main/ROADMAP.md', external: true },
];

const STATUS_ITEMS = [
  { label: 'Network', value: 'Midl Staging' },
  { label: 'Chain ID', value: '15001' },
  { label: 'Execution Layer', value: 'Midl EVM' },
  { label: 'Settlement', value: 'BTC + TSS Vault' },
  { label: 'Finality', value: '\u22651 BTC confirmation' },
];

export function Footer() {
  return (
    <footer
      className="mt-24 border-t"
      style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-surface)' }}
    >
      <div className="container mx-auto px-4 py-10">

        {/* ── Original content ── */}
        <div className="grid gap-8 sm:grid-cols-3 mb-8">
          <div>
            <div className="font-display font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
              MidlLaunch
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
              Bitcoin-native token launchpad on Midl Network.<br />
              Create, discover, and trade bonding curve tokens.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Explorers
            </div>
            <div className="space-y-2">
              <a
                href="https://mempool.staging.midl.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs hover:underline"
                style={{ color: 'var(--orange-500)' }}
              >
                mempool.staging.midl.xyz
              </a>
              <a
                href="https://blockscout.staging.midl.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs hover:underline"
                style={{ color: 'var(--orange-500)' }}
              >
                blockscout.staging.midl.xyz
              </a>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Trust Model
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
              MidlLaunch uses <strong style={{ color: 'var(--text-secondary)' }}>trust-minimized settlement</strong> via TSS validator vaults — not a trustless system. Settlement finality requires Bitcoin confirmation and validator liveness.
              Always verify on both explorers.
            </p>
          </div>
        </div>

        {/* ── B. Legal & Risk Surface ── */}
        <div
          className="border-t pt-8 mb-8 grid gap-8 sm:grid-cols-3"
          style={{ borderColor: 'var(--bg-border)' }}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Legal
            </div>
            <div className="space-y-2">
              {LEGAL_LINKS.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="block text-xs transition-colors hover:underline"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Network
            </div>
            <div className="space-y-2">
              {NETWORK_LINKS.map(({ label, href, external }) => (
                <a
                  key={href}
                  href={href}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noopener noreferrer' : undefined}
                  className="block text-xs transition-colors hover:underline"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Protocol
            </div>
            <div className="space-y-2">
              {PROTOCOL_LINKS.map(({ label, href, external }) => (
                external ? (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs transition-colors hover:underline"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {label}
                  </a>
                ) : (
                  <Link
                    key={href}
                    href={href}
                    className="block text-xs transition-colors hover:underline"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {label}
                  </Link>
                )
              ))}
              <Link
                href="/api-reference"
                className="block text-xs transition-colors hover:underline"
                style={{ color: 'var(--text-tertiary)' }}
              >
                API Reference
              </Link>
            </div>
          </div>
        </div>

        {/* ── C. Risk Disclosure Microcopy ── */}
        <div
          className="border-t pt-5 pb-5"
          style={{ borderColor: 'var(--bg-border)' }}
        >
          <p className="text-xs leading-relaxed max-w-3xl" style={{ color: 'var(--text-tertiary)', opacity: 0.75 }}>
            MidlLaunch enables on-chain token issuance via bonding curves. Token purchases are irreversible and may result in total loss. Always verify transactions on both explorers.
          </p>
        </div>

        {/* ── A. System Status Row ── */}
        <div
          className="border-t pt-4 pb-5"
          style={{ borderColor: 'var(--bg-border)' }}
        >
          <div className="flex flex-wrap items-center gap-x-0 gap-y-2">
            {STATUS_ITEMS.map(({ label, value }, i) => (
              <div key={label} className="flex items-center">
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>
                  {label}:&nbsp;
                </span>
                <span className="text-[10px] font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {value}
                </span>
                {i < STATUS_ITEMS.length - 1 && (
                  <span className="mx-3 text-[10px]" style={{ color: 'var(--bg-border)' }}>|</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Original copyright bottom bar ── */}
        <div
          className="border-t pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs"
          style={{ borderColor: 'var(--bg-border)', color: 'var(--text-tertiary)' }}
        >
          <span>© 2026 MidlLaunch · Staging Network · Not financial advice</span>
          <span>Chain ID 15001 · regtest</span>
        </div>

      </div>
    </footer>
  );
}
