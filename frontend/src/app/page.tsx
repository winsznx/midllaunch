'use client';

import Link from 'next/link';
import { useGlobalStats, useGlobalActivity } from '@/lib/hooks/useLaunches';
import { LiveTicker } from '@/components/ui/LiveTicker';
import { formatBTC } from '@/lib/wallet';

export default function Home() {
  const { data: stats } = useGlobalStats();
  const { data: activityData } = useGlobalActivity(5);

  const latestEvent = activityData?.events?.[0];

  return (
    <div className="bg-background text-foreground transition-colors duration-200">
      <LiveTicker />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 font-sans">

        {/* SECTION 1 — Hero (Proof-First) */}
        <section className="py-24 md:py-32 xl:py-40 max-w-5xl mx-auto border-x border-border px-4 sm:px-8 xl:px-12 bg-surface">
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6 uppercase leading-[1.05]" style={{ fontStretch: 'expanded' }}>
            Bitcoin-Native Token Issuance.<br />Live on Midl.
          </h1>
          <p className="text-lg md:text-xl mb-12 tracking-wide font-medium max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
            Linear bonding curve launches. Settled in BTC. Verifiable on-chain.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-20 max-w-md">
            <Link href="/create" className="btn btn-primary px-8 py-4 text-center uppercase tracking-widest text-sm w-full sm:w-auto">
              Launch Token
            </Link>
            <Link href="/launches" className="btn btn-secondary px-8 py-4 text-center uppercase tracking-widest text-sm w-full sm:w-auto">
              Browse Launches
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 border-t border-l border-border bg-background shadow-2xl">
            <div className="p-6 border-r border-b border-border flex flex-col justify-between h-32 hover:bg-surface transition-colors">
              <div className="text-[10px] sm:text-xs uppercase tracking-widest font-mono" style={{ color: 'var(--text-tertiary)' }}>Total BTC Deposited</div>
              <div className="text-xl lg:text-3xl font-mono tracking-tighter">
                {stats ? `₿ ${formatBTC(stats.totalBTCDeposited || '0')}` : '---'}
              </div>
            </div>
            <div className="p-6 border-r border-b border-border flex flex-col justify-between h-32 hover:bg-surface transition-colors">
              <div className="text-[10px] sm:text-xs uppercase tracking-widest font-mono" style={{ color: 'var(--text-tertiary)' }}>Total Launches</div>
              <div className="text-xl lg:text-3xl font-mono tracking-tighter">
                {stats ? stats.totalLaunches : '---'}
              </div>
            </div>
            <div className="p-6 border-r border-b border-border flex flex-col justify-between h-32 hover:bg-surface transition-colors">
              <div className="text-[10px] sm:text-xs uppercase tracking-widest font-mono" style={{ color: 'var(--text-tertiary)' }}>Active Curves</div>
              <div className="text-xl lg:text-3xl font-mono tracking-tighter">
                {stats ? stats.activeLaunches : '---'}
              </div>
            </div>
            <div className="p-6 border-r border-b border-border flex flex-col justify-between h-32 overflow-hidden hover:bg-surface transition-colors">
              <div className="text-[10px] sm:text-xs uppercase tracking-widest font-mono" style={{ color: 'var(--text-tertiary)' }}>Latest Execution</div>
              <div className="text-sm lg:text-base font-mono truncate mt-auto" style={{ color: 'var(--text-secondary)' }}>
                {latestEvent ? (
                  <a href={`https://blockscout.staging.midl.xyz/tx/${latestEvent.txHash}`} target="_blank" rel="noreferrer" className="hover:text-foreground underline decoration-border underline-offset-4">
                    {latestEvent.txHash.slice(0, 8)}...{latestEvent.txHash.slice(-6)}
                  </a>
                ) : (
                  <span className="tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>Awaiting</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 — Live Activity */}
        <section className="py-20 md:py-32 max-w-5xl mx-auto border-t border-border">
          <h2 className="text-base md:text-lg font-mono font-bold mb-8 uppercase tracking-widest flex items-center gap-3">
            <span className="w-2 h-2" style={{ backgroundColor: 'var(--text-primary)' }}></span> Live Execution Stream
          </h2>

          <div className="border border-border bg-background overflow-x-auto shadow-2xl">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-12 gap-4 px-6 py-4 text-[10px] sm:text-xs uppercase tracking-widest border-b border-border bg-elevated font-mono" style={{ color: 'var(--text-tertiary)' }}>
                <div className="col-span-3">Wallet</div>
                <div className="col-span-3">Amount</div>
                <div className="col-span-3">Token</div>
                <div className="col-span-3 text-right">Explorer</div>
              </div>

              <div className="divide-y divide-border bg-surface">
                {activityData?.events && activityData.events.length > 0 ? (
                  activityData.events.slice(0, 5).map((event, i) => (
                    <div key={`${event.txHash}-${i}`} className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-elevated transition-colors">
                      <div className="col-span-3 font-mono text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {event.buyerAddress.slice(0, 6)}...{event.buyerAddress.slice(-4)}
                      </div>
                      <div className="col-span-3 font-mono text-xs sm:text-sm font-medium">
                        {formatBTC(event.amountSats)} BTC
                      </div>
                      <div className="col-span-3 font-mono text-xs sm:text-sm font-bold uppercase tracking-widest">
                        {event.tokenSymbol}
                      </div>
                      <div className="col-span-3 text-right">
                        <a
                          href={`https://blockscout.staging.midl.xyz/tx/${event.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-mono hover:text-foreground transition-colors uppercase tracking-widest"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          Verify
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><path d="M7 17l9.2-9.2M17 17V7H7" /></svg>
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-16 text-center text-xs font-mono uppercase tracking-widest bg-surface" style={{ color: 'var(--text-tertiary)' }}>
                    Listening for on-chain events...
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 — System Flow */}
        <section className="py-20 md:py-32 max-w-5xl mx-auto border-t border-border">
          <h2 className="text-base md:text-lg font-mono font-bold mb-8 uppercase tracking-widest flex items-center gap-3">
            <span className="w-2 h-2" style={{ backgroundColor: 'var(--text-primary)' }}></span> Protocol Architecture
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 border-t border-l border-border shadow-2xl">
            {[
              { num: "01", title: "Sign Bitcoin Transaction", desc: "Construct and sign partially signed Bitcoin transaction (PSBT) natively.", link: "mempool.staging.midl.xyz" },
              { num: "02", title: "Midl Executes Solidity", desc: "Midl L2 ingests operation and executes Solidity smart contract state change.", link: "blockscout.staging.midl.xyz" },
              { num: "03", title: "Bonding Curve Mints Tokens", desc: "Programmable linear bonding curve deterministically mints token allocation.", link: "blockscout.staging.midl.xyz" },
              { num: "04", title: "Settlement Confirmed on Bitcoin", desc: "Global state root committed and finality achieved on Bitcoin mainnet.", link: "mempool.staging.midl.xyz" }
            ].map((step, i) => (
              <div key={i} className="border-r border-b border-border p-8 flex flex-col bg-surface hover:bg-elevated transition-colors">
                <div className="flex justify-between items-start mb-12">
                  <div className="w-6 h-6 border border-border flex items-center justify-center text-[10px] font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <div className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{step.num}</div>
                </div>
                <h3 className="font-semibold mb-3 tracking-wide text-sm">{step.title}</h3>
                <p className="text-sm mb-8 flex-grow leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{step.desc}</p>
                <div className="mt-auto pt-4 border-t border-border">
                  <span className="text-[10px] font-mono truncate block uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                    REF: {step.link.split('/')[0]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4 — Product Preview */}
        <section className="py-20 md:py-32 max-w-5xl mx-auto border-t border-border">
          <h2 className="text-base md:text-lg font-mono font-bold mb-8 uppercase tracking-widest flex items-center gap-3">
            <span className="w-2 h-2" style={{ backgroundColor: 'var(--text-primary)' }}></span> Interface Topography
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Form Preview */}
            <div className="border border-border bg-surface p-6 sm:p-8 flex flex-col min-h-[460px] shadow-2xl relative transition-colors">
              <div className="text-[10px] font-mono mb-8 border-b border-border pb-4 flex justify-between uppercase tracking-widest relative z-10" style={{ color: 'var(--text-tertiary)' }}>
                <span>FORM: INIT_LAUNCH</span>
                <span>STATE: READY</span>
              </div>
              <div className="space-y-6 flex-grow font-sans relative z-10">
                <div className="space-y-2.5">
                  <div className="text-[10px] font-mono tracking-widest uppercase flex justify-between" style={{ color: 'var(--text-tertiary)' }}>
                    <span>Token Name</span>
                    <span style={{ color: 'var(--orange-500)' }}>*</span>
                  </div>
                  <div className="h-12 bg-background border border-border flex items-center px-4 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>Input name...</div>
                </div>
                <div className="space-y-2.5">
                  <div className="text-[10px] font-mono tracking-widest uppercase flex justify-between" style={{ color: 'var(--text-tertiary)' }}>
                    <span>Ticker Symbol</span>
                    <span style={{ color: 'var(--orange-500)' }}>*</span>
                  </div>
                  <div className="h-12 bg-background border border-border flex items-center px-4 text-sm font-mono transition-colors" style={{ color: 'var(--text-secondary)' }}>$</div>
                </div>
                <div className="space-y-2 mt-auto pt-10">
                  <div className="btn btn-primary w-full shadow-none font-mono text-xs mt-auto">
                    SIGN & DEPLOY
                  </div>
                </div>
              </div>
            </div>

            {/* Widget Preview */}
            <div className="border border-border bg-surface p-6 sm:p-8 flex flex-col min-h-[460px] shadow-2xl relative transition-colors">
              <div className="text-[10px] font-mono mb-8 border-b border-border pb-4 flex justify-between uppercase tracking-widest relative z-10" style={{ color: 'var(--text-tertiary)' }}>
                <span>UI: TRADE_ENGINE</span>
                <span>CURVE: ACTIVE</span>
              </div>
              <div className="space-y-3 flex-grow flex flex-col justify-center relative z-10">
                <div className="bg-background border border-border p-5 relative min-h-[110px] flex flex-col justify-end">
                  <div className="text-[10px] font-mono absolute top-4 left-5 uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Pay (BTC)</div>
                  <div className="text-3xl font-mono text-right tracking-tighter">0.0500</div>
                </div>
                <div className="flex justify-center py-3 relative" style={{ color: 'var(--text-secondary)' }}>
                  <div className="absolute inset-0 flex items-center"><div className="w-full h-px" style={{ backgroundColor: 'var(--bg-border)' }}></div></div>
                  <div className="bg-surface relative px-4 z-10 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                  </div>
                </div>
                <div className="bg-background border border-border p-5 relative min-h-[110px] flex flex-col justify-end">
                  <div className="text-[10px] font-mono absolute top-4 left-5 uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Receive (EST)</div>
                  <div className="text-3xl font-mono text-right tracking-tighter flex items-center justify-end gap-3">
                    2,450 <span className="text-base font-sans tracking-normal font-bold" style={{ color: 'var(--text-secondary)' }}>TKN</span>
                  </div>
                </div>
                <div className="mt-6 flex justify-between text-[9px] font-mono uppercase tracking-widest px-1 border-t border-border pt-5" style={{ color: 'var(--text-tertiary)' }}>
                  <span>Slippage: 0.5%</span>
                  <span>Fee: 1%</span>
                </div>
              </div>
            </div>

            {/* Curve Preview */}
            <div className="border border-border bg-surface p-6 sm:p-8 flex flex-col min-h-[460px] relative overflow-hidden shadow-2xl transition-colors">
              <div className="text-[10px] font-mono mb-8 border-b border-border pb-4 flex justify-between uppercase tracking-widest z-10 relative" style={{ color: 'var(--text-tertiary)' }}>
                <span>VISUAL: PRICING_MODEL</span>
                <span>TYPE: LINEAR</span>
              </div>

              <div className="flex-grow w-full h-full relative flex items-end pt-4 pb-0 z-10">
                <div className="absolute inset-0 bg-background border border-border"></div>
                <svg viewBox="0 0 100 100" className="w-full h-full relative z-10" preserveAspectRatio="none">
                  {/* Grid lines */}
                  <line x1="0" y1="25" x2="100" y2="25" stroke="var(--bg-border)" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
                  <line x1="0" y1="50" x2="100" y2="50" stroke="var(--bg-border)" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
                  <line x1="0" y1="75" x2="100" y2="75" stroke="var(--bg-border)" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
                  <line x1="25" y1="0" x2="25" y2="100" stroke="var(--bg-border)" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
                  <line x1="50" y1="0" x2="50" y2="100" stroke="var(--bg-border)" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
                  <line x1="75" y1="0" x2="75" y2="100" stroke="var(--bg-border)" strokeWidth="0.5" strokeDasharray="1.5 1.5" />

                  {/* The linear curve line */}
                  <line x1="0" y1="90" x2="70" y2="20" stroke="var(--text-primary)" strokeWidth="1.5" />
                  <line x1="70" y1="20" x2="100" y2="-10" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="2 2" />

                  {/* Current position marker */}
                  <circle cx="70" cy="20" r="2.5" fill="var(--text-primary)" />
                  <circle cx="70" cy="20" r="7" fill="none" stroke="var(--text-secondary)" strokeWidth="0.5" />
                  <line x1="70" y1="20" x2="70" y2="100" stroke="var(--text-secondary)" strokeWidth="0.5" strokeDasharray="2 2" />
                  <line x1="0" y1="20" x2="70" y2="20" stroke="var(--text-secondary)" strokeWidth="0.5" strokeDasharray="2 2" />
                </svg>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
