import Link from 'next/link';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-20">
      <h2
        className="font-display font-bold text-lg mb-4 pb-3 border-b"
        style={{ color: 'var(--text-primary)', borderColor: 'var(--bg-border)' }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </p>
  );
}

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-10">
        <div
          className="text-[10px] font-mono font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Legal · MidlLaunch Staging Network
        </div>
        <h1 className="font-display font-bold mb-3" style={{ fontSize: '2rem', color: 'var(--text-primary)' }}>
          Privacy Policy
        </h1>
        <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
          Last updated: February 2026 · Staging environment only
        </p>
      </div>

      <Section id="overview" title="1. Overview">
        <Para>
          MidlLaunch is a blockchain protocol. By its nature, most interactions with the Protocol are public and on-chain. This policy describes what data we collect, why, and how it is used.
        </Para>
        <Para>
          This privacy policy applies to the MidlLaunch staging deployment only.
        </Para>
      </Section>

      <Section id="on-chain" title="2. On-Chain Data (Public)">
        <Para>
          All transactions on MidlLaunch — including token launches, purchases, sells, and NFT mints — are recorded on the Bitcoin blockchain and Midl EVM. This data is permanently public and includes:
        </Para>
        <ul className="space-y-2 text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          {[
            'Your Bitcoin address and EVM address',
            'Transaction amounts (BTC and token quantities)',
            'Timestamps and block numbers',
            'Token names, symbols, and metadata CIDs',
            'Intent IDs and transaction hashes',
          ].map(item => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--bg-border)' }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <Para>
          We have no ability to delete or modify on-chain data. Do not transact if you require anonymity.
        </Para>
      </Section>

      <Section id="off-chain" title="3. Off-Chain Data We Store">
        <Para>
          Our backend database stores indexed copies of on-chain data to power the frontend. This includes launch records, purchase history, and comment content. This data mirrors the public blockchain.
        </Para>
        <Para>
          We also store pending metadata (token name, symbol, IPFS CID) temporarily before a launch transaction confirms, to enable metadata linking. This is deleted after being applied.
        </Para>
        <Para>
          If you link an X (Twitter) handle to your wallet via the bot integration, we store that mapping (handle → wallet address) in our database.
        </Para>
      </Section>

      <Section id="metadata" title="4. Token Metadata and IPFS">
        <Para>
          Images and metadata uploaded during token or NFT creation are stored on IPFS via Pinata. IPFS content is publicly accessible by its CID and is permanent by design. Do not upload private information.
        </Para>
      </Section>

      <Section id="analytics" title="5. Analytics">
        <Para>
          We use Vercel Analytics for anonymous aggregate page view metrics. No personal data is collected or sold.
        </Para>
      </Section>

      <Section id="cookies" title="6. Local Storage">
        <Para>
          We store a single key in your browser&apos;s localStorage (<code className="font-mono text-xs px-1 rounded" style={{ background: 'var(--bg-elevated)' }}>midl_disclaimer_accepted_v1</code>) to record that you have accepted the usage disclaimer. No cookies are set.
        </Para>
      </Section>

      <Section id="third-party" title="7. Third-Party Services">
        <Para>
          MidlLaunch integrates with the following third-party services:
        </Para>
        <ul className="space-y-2 text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          {[
            'Pinata — IPFS pinning for token and NFT metadata',
            'Vercel — hosting and analytics',
            'Midl Network — EVM execution layer and RPC',
            'X (Twitter) API — for the social trading bot integration',
          ].map(item => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--bg-border)' }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="contact" title="8. Contact">
        <Para>
          This is a staging deployment. For questions, reach out via the project&apos;s public channels.
        </Para>
      </Section>

      <div
        className="border-t pt-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between text-xs"
        style={{ borderColor: 'var(--bg-border)', color: 'var(--text-tertiary)' }}
      >
        <span>Midl Staging Network · Chain ID 15001</span>
        <div className="flex gap-4">
          <Link href="/terms" className="hover:underline" style={{ color: 'var(--text-tertiary)' }}>
            Terms of Service
          </Link>
          <Link href="/risk-disclosure" className="hover:underline" style={{ color: 'var(--text-tertiary)' }}>
            Risk Disclosure
          </Link>
          <Link href="/launches" className="hover:underline" style={{ color: 'var(--text-tertiary)' }}>
            Back to App
          </Link>
        </div>
      </div>
    </div>
  );
}
