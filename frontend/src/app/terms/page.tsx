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

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
          Last updated: February 2026 · Staging environment only
        </p>
      </div>

      <div
        className="p-4 rounded-xl mb-10 text-xs leading-relaxed"
        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--text-secondary)' }}
      >
        MidlLaunch is currently deployed on the <strong style={{ color: 'var(--text-primary)' }}>Midl Staging Network</strong> (Chain ID 15001).
        This is a testnet environment. Do not use real funds.
      </div>

      <Section id="acceptance" title="1. Acceptance of Terms">
        <Para>
          By accessing or using MidlLaunch (&quot;the Protocol&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Protocol.
        </Para>
        <Para>
          These terms apply to the staging deployment at this domain. They do not constitute a binding commercial agreement and are provided for informational purposes during the testing phase.
        </Para>
      </Section>

      <Section id="protocol" title="2. Protocol Description">
        <Para>
          MidlLaunch is a primary token issuance platform built on Midl&apos;s execution layer. It enables users to create and trade ERC-20 tokens and NFT collections via linear bonding curves, with value transfer denominated in BTC.
        </Para>
        <Para>
          All transactions require a Bitcoin wallet (Xverse or Leather) and are settled on Midl&apos;s EVM layer via a TSS validator vault. Execution requires at least one Bitcoin confirmation.
        </Para>
      </Section>

      <Section id="risks" title="3. Risk Acknowledgment">
        <Para>
          Token purchases are irreversible and may result in total loss of funds. Price is determined by the bonding curve and supply at the time of execution — not at the time of signing. There are no guarantees of price performance, liquidity, or execution success.
        </Para>
        <Para>
          MidlLaunch is <strong style={{ color: 'var(--text-primary)' }}>not a trustless system</strong>. Settlement depends on the liveness and honest behavior of Midl validators. If validators are offline, pending transactions may not execute and deposited BTC may be temporarily illiquid.
        </Para>
        <Para>
          You are solely responsible for verifying your transactions on both the Bitcoin mempool explorer and the Midl EVM block explorer.
        </Para>
      </Section>

      <Section id="prohibited" title="4. Prohibited Use">
        <Para>You agree not to use the Protocol to:</Para>
        <ul className="space-y-2 text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          {[
            'Violate any applicable law or regulation',
            'Manipulate token prices or engage in wash trading',
            'Exploit vulnerabilities in smart contracts or the frontend',
            'Impersonate other users or misrepresent your identity',
            'Use the Protocol in jurisdictions where it is prohibited',
          ].map(item => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--bg-border)' }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="disclaimer" title="5. Disclaimer of Warranties">
        <Para>
          The Protocol is provided &quot;as is&quot; without warranties of any kind, express or implied. MidlLaunch does not warrant that the Protocol will be uninterrupted, error-free, or that defects will be corrected.
        </Para>
        <Para>
          Nothing on this platform constitutes financial, investment, or legal advice. You are solely responsible for your own investment decisions.
        </Para>
      </Section>

      <Section id="liability" title="6. Limitation of Liability">
        <Para>
          To the maximum extent permitted by applicable law, MidlLaunch and its contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of funds, loss of profits, or loss of data.
        </Para>
      </Section>

      <Section id="changes" title="7. Changes to Terms">
        <Para>
          These terms may be updated at any time. Continued use of the Protocol after changes constitutes acceptance of the updated terms.
        </Para>
      </Section>

      <div
        className="border-t pt-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between text-xs"
        style={{ borderColor: 'var(--bg-border)', color: 'var(--text-tertiary)' }}
      >
        <span>Midl Staging Network · Chain ID 15001</span>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:underline" style={{ color: 'var(--text-tertiary)' }}>
            Privacy Policy
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
