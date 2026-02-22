import Link from 'next/link';

function RiskItem({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="p-5 rounded-xl"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
    >
      <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {title}
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {body}
      </p>
    </div>
  );
}

const RISKS = [
  {
    title: 'Total Loss of Funds',
    body: 'Token and NFT purchases are irreversible. The value of tokens can go to zero. There is no backstop, insurance, or guaranteed exit price. You may lose your entire investment.',
  },
  {
    title: 'Price Volatility',
    body: 'Token price is a function of supply. Large purchases cause significant price impact. Price at execution will differ from price at signing due to bonding curve mechanics and other transactions confirming in between.',
  },
  {
    title: 'No Liquidity Guarantee',
    body: 'Liquidity is provided solely by the bonding curve. There is no AMM, no order book, and no external market maker. You may be unable to sell tokens at a price you consider acceptable.',
  },
  {
    title: 'Validator Custody Risk',
    body: 'BTC deposited to the protocol is held in a Threshold Signature Scheme (TSS) vault controlled by Midl validators. This is trust-minimized but not trustless. Validator misbehavior or liveness failure could result in locked or lost funds.',
  },
  {
    title: 'Execution Latency',
    body: 'Transactions require at least one Bitcoin confirmation before execution. During this window, price may move. If slippage tolerance is exceeded, the transaction reverts and BTC is returned in the next settlement cycle — not immediately.',
  },
  {
    title: 'Smart Contract Risk',
    body: 'Despite audits and test coverage, smart contracts may contain bugs or vulnerabilities. Interactions with any on-chain protocol carry the risk of exploits that could result in loss of funds.',
  },
  {
    title: 'Regulatory Risk',
    body: 'The regulatory treatment of token issuance, trading, and DeFi protocols varies by jurisdiction and may change. You are responsible for determining whether your use of MidlLaunch complies with applicable laws in your region.',
  },
  {
    title: 'Testnet / Staging Status',
    body: 'MidlLaunch is currently deployed on the Midl Staging Network (Chain ID 15001). This is a test environment. Do not use real funds. Contract addresses, parameters, and behavior may change without notice.',
  },
  {
    title: 'Metadata and Verification',
    body: 'Token names, symbols, images, and social links are user-supplied. MidlLaunch does not verify the accuracy, legitimacy, or completeness of any token metadata. Anyone can create a token with any name. Conduct your own research.',
  },
  {
    title: 'No Recourse',
    body: 'Once a transaction is broadcast and confirmed on Bitcoin, it cannot be reversed. There is no customer support mechanism to recover lost funds or undo transactions.',
  },
];

export default function RiskDisclosurePage() {
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
          Risk Disclosure
        </h1>
        <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
          Last updated: February 2026 · Staging environment only
        </p>
      </div>

      <div
        className="p-5 rounded-xl mb-10 text-sm leading-relaxed"
        style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--text-secondary)' }}
      >
        <strong style={{ color: 'var(--text-primary)' }}>Read this carefully.</strong> Using MidlLaunch involves significant financial risk.
        The following risks are not exhaustive. By continuing, you confirm that you have read and understood this disclosure.
      </div>

      <div className="space-y-4 mb-12">
        {RISKS.map(risk => (
          <RiskItem key={risk.title} {...risk} />
        ))}
      </div>

      <div
        className="p-5 rounded-xl mb-10 text-xs leading-relaxed"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', color: 'var(--text-tertiary)' }}
      >
        Nothing on MidlLaunch constitutes financial, investment, legal, or tax advice. This platform is experimental software.
        Use it at your own risk. Always verify transactions on the{' '}
        <a
          href="https://mempool.staging.midl.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
          style={{ color: 'var(--orange-500)' }}
        >
          Bitcoin mempool
        </a>{' '}
        and{' '}
        <a
          href="https://blockscout.staging.midl.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
          style={{ color: 'var(--orange-500)' }}
        >
          Midl Blockscout
        </a>.
      </div>

      <div
        className="border-t pt-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between text-xs"
        style={{ borderColor: 'var(--bg-border)', color: 'var(--text-tertiary)' }}
      >
        <span>Midl Staging Network · Chain ID 15001</span>
        <div className="flex gap-4">
          <Link href="/terms" className="hover:underline" style={{ color: 'var(--text-tertiary)' }}>
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:underline" style={{ color: 'var(--text-tertiary)' }}>
            Privacy Policy
          </Link>
          <Link href="/launches" className="hover:underline" style={{ color: 'var(--text-tertiary)' }}>
            Back to App
          </Link>
        </div>
      </div>
    </div>
  );
}
