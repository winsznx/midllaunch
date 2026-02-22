import Link from 'next/link';

const MEMPOOL = 'https://mempool.staging.midl.xyz';
const BLOCKSCOUT = 'https://blockscout.staging.midl.xyz';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-14 scroll-mt-20">
      <div
        className="text-[10px] font-mono font-semibold uppercase tracking-widest mb-2"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {id.replace('-', ' ')}
      </div>
      <h2
        className="font-display font-bold text-xl mb-5 pb-3 border-b"
        style={{ color: 'var(--text-primary)', borderColor: 'var(--bg-border)' }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function FlowBlock({
  index,
  title,
  body,
  explorer,
}: {
  index: number;
  title: string;
  body: string;
  explorer?: { label: string; href: string };
}) {
  return (
    <div
      className="flex gap-5 p-5 rounded-xl"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-tertiary)', border: '1px solid var(--bg-border)' }}
      >
        {String(index).padStart(2, '0')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          {title}
        </div>
        <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>
          {body}
        </p>
        {explorer && (
          <a
            href={explorer.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono hover:underline"
            style={{ color: 'var(--orange-500)' }}
          >
            Verify on {explorer.label} &rarr;
          </a>
        )}
      </div>
    </div>
  );
}

function DefinitionRow({ term, definition }: { term: string; definition: string }) {
  return (
    <div
      className="flex gap-4 py-3 border-b"
      style={{ borderColor: 'var(--bg-border)' }}
    >
      <dt
        className="w-40 flex-shrink-0 text-xs font-mono font-medium pt-0.5"
        style={{ color: 'var(--text-secondary)' }}
      >
        {term}
      </dt>
      <dd className="flex-1 text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
        {definition}
      </dd>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">

      {/* Page header */}
      <div className="mb-12">
        <div
          className="text-[10px] font-mono font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Protocol Documentation · Midl Staging Network
        </div>
        <h1
          className="font-display font-bold mb-4"
          style={{ fontSize: '2rem', color: 'var(--text-primary)' }}
        >
          How It Works
        </h1>
        <p className="text-sm leading-relaxed max-w-xl" style={{ color: 'var(--text-secondary)' }}>
          MidlLaunch enables Bitcoin-settled token issuance using linear bonding curves.
          This document describes the execution model, settlement mechanics, and trust assumptions.
        </p>
      </div>

      {/* Table of contents */}
      <nav
        className="mb-12 p-5 rounded-xl text-xs space-y-1"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
      >
        <div className="font-mono font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
          Contents
        </div>
        {[
          { href: '#overview', label: '1. Overview' },
          { href: '#execution-flow', label: '2. Execution Flow' },
          { href: '#settlement', label: '3. Settlement Model' },
          { href: '#trust-model', label: '4. Trust Model' },
          { href: '#bonding-curve', label: '5. Bonding Curve Model' },
          { href: '#non-goals', label: '6. Non-Goals' },
        ].map(({ href, label }) => (
          <div key={href}>
            <a
              href={href}
              className="hover:underline font-mono"
              style={{ color: 'var(--text-secondary)' }}
            >
              {label}
            </a>
          </div>
        ))}
      </nav>

      {/* 1. Overview */}
      <Section id="overview" title="Overview">
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
          MidlLaunch is a primary issuance platform. Tokens are created and traded against a bonding
          curve denominated in BTC. There is no order book. Price is a deterministic function of
          supply. Liquidity is provided by the curve itself.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          All value transfer is initiated via Bitcoin transactions. Execution of the bonding curve
          logic occurs in Midl&apos;s EVM layer. The two layers are linked by Midl&apos;s intent system
          and settled via a TSS validator vault.
        </p>
      </Section>

      {/* 2. Execution Flow */}
      <Section id="execution-flow" title="Execution Flow">
        <div className="space-y-3">
          <FlowBlock
            index={1}
            title="User signs a Bitcoin transaction"
            body="The buyer constructs and signs a PSBT (Partially Signed Bitcoin Transaction) that sends BTC to the protocol vault. This happens inside the connected wallet — no custody is transferred until broadcast."
            explorer={{ label: 'Mempool', href: MEMPOOL }}
          />
          <FlowBlock
            index={2}
            title="Intent is attached and broadcast"
            body="Before broadcasting, a signed EVM intent is linked to the BTC transaction. The intent encodes the target bonding curve contract call (buy or sell) with minimum output constraints. Both are submitted atomically."
          />
          <FlowBlock
            index={3}
            title="Midl executes the EVM call"
            body="Once the BTC transaction is confirmed, Midl's sequencer executes the Solidity function specified in the intent. Execution order is determined by BTC confirmation order — not submission time."
            explorer={{ label: 'Blockscout', href: BLOCKSCOUT }}
          />
          <FlowBlock
            index={4}
            title="Tokens are minted via the bonding curve"
            body="The bonding curve contract mints tokens to the buyer's EVM address. Price is updated atomically. The new supply and price are reflected immediately on-chain. The buyer holds ERC-20 tokens on Midl EVM."
            explorer={{ label: 'Blockscout', href: BLOCKSCOUT }}
          />
        </div>
      </Section>

      {/* 3. Settlement Model */}
      <Section id="settlement" title="Settlement Model">
        <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
          Settlement connects Bitcoin value to EVM execution. The following concepts govern how
          funds move through the system.
        </p>
        <dl className="border-t" style={{ borderColor: 'var(--bg-border)' }}>
          <DefinitionRow
            term="vBTC Credit"
            definition="When BTC is deposited to the vault, the sequencer credits an equivalent vBTC balance to the intent. This vBTC is used to pay for the EVM execution. It is not a synthetic token — it is an accounting primitive internal to the settlement layer."
          />
          <DefinitionRow
            term="Execution Ordering"
            definition="Intents are executed in BTC confirmation order. If two transactions confirm in the same block, ordering follows transaction index within that block. There is no priority fee mechanism."
          />
          <DefinitionRow
            term="Revert Semantics"
            definition="If the EVM call reverts (e.g. slippage exceeded), the BTC deposit is refunded to the sender. Refunds are processed in the next settlement cycle. Gas consumed prior to revert is not returned."
          />
          <DefinitionRow
            term="Sell Withdrawal"
            definition="When selling tokens, the bonding curve releases BTC from the vault proportional to the tokens returned. The withdrawal is settled in the same BTC confirmation window as the sale intent."
          />
          <DefinitionRow
            term="Finality"
            definition="A transaction is considered final after at least 1 Bitcoin confirmation. Prior to confirmation, execution has not occurred and the state is provisional. Do not treat a broadcast as final."
          />
        </dl>
      </Section>

      {/* 4. Trust Model */}
      <Section id="trust-model" title="Trust Model">
        <div
          className="p-4 rounded-xl mb-5 text-xs leading-relaxed"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--text-secondary)' }}
        >
          MidlLaunch is <strong style={{ color: 'var(--text-primary)' }}>not a trustless system</strong>.
          The protocol depends on validator liveness and honest behavior. Users must understand and accept
          this before transacting.
        </div>
        <dl className="border-t" style={{ borderColor: 'var(--bg-border)' }}>
          <DefinitionRow
            term="TSS Validator Custody"
            definition="BTC deposited to the vault is held under a Threshold Signature Scheme (TSS) — a multi-party cryptographic vault. Funds can only be moved if a threshold of validators sign. This reduces single-party risk but does not eliminate custodial risk."
          />
          <DefinitionRow
            term="Bitcoin Confirmation Required"
            definition="No execution occurs without an on-chain BTC confirmation. This prevents front-running by the sequencer at the cost of latency. Transactions that do not confirm are not executed."
          />
          <DefinitionRow
            term="Validator Liveness"
            definition="If validators are offline, pending intents will not execute. BTC already in the vault may not be immediately withdrawable. Users should not deposit more BTC than they can tolerate being illiquid during a validator outage."
          />
          <DefinitionRow
            term="Verification Responsibility"
            definition="Users are responsible for verifying their transactions on both the Bitcoin mempool explorer and the EVM explorer. MidlLaunch does not guarantee execution success or price accuracy."
          />
        </dl>
      </Section>

      {/* 5. Bonding Curve Model */}
      <Section id="bonding-curve" title="Bonding Curve Model">
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
          MidlLaunch uses a <strong style={{ color: 'var(--text-primary)' }}>linear bonding curve</strong>.
          Price is a linear function of total supply sold.
        </p>
        <div
          className="p-4 rounded-xl mb-5 font-mono text-xs"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}
        >
          <div className="mb-1">price(supply) = base_price + (supply &times; price_increment)</div>
          <div style={{ color: 'var(--text-tertiary)' }}>
            — price increases linearly as more tokens are sold
          </div>
        </div>
        <dl className="border-t" style={{ borderColor: 'var(--bg-border)' }}>
          <DefinitionRow
            term="Base Price"
            definition="The price of the first token sold. Set by the creator at launch time. Denominated in satoshis."
          />
          <DefinitionRow
            term="Price Increment"
            definition="The rate at which price increases per token sold. A higher increment means steeper price appreciation and a more volatile curve."
          />
          <DefinitionRow
            term="Supply Cap"
            definition="The maximum number of tokens that can be minted via the bonding curve. Once the cap is reached, the launch is finalized. Further trading occurs only on secondary markets."
          />
          <DefinitionRow
            term="Slippage"
            definition="Because price is a function of supply, any purchase moves the price. Users set a minimum output amount (slippage tolerance) in their intent. If execution would produce fewer tokens than the minimum, the transaction reverts."
          />
          <DefinitionRow
            term="Price Impact"
            definition="Large purchases relative to remaining supply cause significant price movement. The effective price paid per token will be higher than the current spot price. This is inherent to the curve model."
          />
        </dl>
      </Section>

      {/* 6. Non-Goals */}
      <Section id="non-goals" title="Non-Goals">
        <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
          The following are explicitly outside the scope of MidlLaunch&apos;s protocol design:
        </p>
        <ul className="space-y-2.5">
          {[
            'Automated Market Maker (AMM) — MidlLaunch is not an AMM. There is no liquidity pool.',
            'Limit orders or order book — Execution is market-only, against the bonding curve.',
            'Price guarantees — Price is determined by the curve and supply at time of execution.',
            'Liquidity guarantees — There is no backstop or guaranteed exit price.',
            'Custody of user BTC beyond settlement — BTC is held only for the duration of the settlement window. It is not a lending or yield product.',
            'Anonymity — All transactions are on-chain and traceable on both Bitcoin and Midl EVM.',
          ].map(item => (
            <li key={item} className="flex items-start gap-3">
              <span
                className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: 'var(--bg-border)' }}
              />
              <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {item}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Bottom links */}
      <div
        className="border-t pt-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between text-xs"
        style={{ borderColor: 'var(--bg-border)', color: 'var(--text-tertiary)' }}
      >
        <span>Midl Staging Network · Chain ID 15001</span>
        <div className="flex gap-4">
          <a
            href={MEMPOOL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Mempool Explorer
          </a>
          <a
            href={BLOCKSCOUT}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Blockscout Explorer
          </a>
          <Link
            href="/launches"
            className="hover:underline"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Back to App
          </Link>
        </div>
      </div>
    </div>
  );
}
