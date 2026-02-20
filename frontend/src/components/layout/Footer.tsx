export function Footer() {
  return (
    <footer
      className="mt-24 border-t"
      style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-surface)' }}
    >
      <div className="container mx-auto px-4 py-10">
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

        <div
          className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs"
          style={{ borderColor: 'var(--bg-border)', color: 'var(--text-tertiary)' }}
        >
          <span>© 2026 MidlLaunch · Staging Network · Not financial advice</span>
          <span>Chain ID 15001 · regtest</span>
        </div>
      </div>
    </footer>
  );
}
