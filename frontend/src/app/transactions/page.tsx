'use client';

import { useAccounts } from '@midl/react';
import { AddressPurpose } from '@midl/core';
import { useAccount } from 'wagmi';
import { useUserActivity } from '@/lib/hooks/useLaunches';
import { formatTokenAmount, formatBTC } from '@/lib/wallet';
import Link from 'next/link';

const BTC_EXPLORER = 'https://mempool.staging.midl.xyz/tx';
const EVM_EXPLORER = 'https://blockscout.staging.midl.xyz/tx';

const LIFECYCLE_STEPS = [
  { label: 'Signed', desc: 'BTC transaction signed by wallet' },
  { label: 'BTC Confirmed', desc: 'Included in a Bitcoin block' },
  { label: 'Midl Executed', desc: 'EVM transaction executed on Midl' },
  { label: 'Finalized', desc: 'Settlement complete and irreversible' },
];

function ExplorerLinks({ btcTxId, evmTxHash }: { btcTxId?: string | null; evmTxHash?: string | null }) {
  if (!btcTxId && !evmTxHash) return null;

  // Sometimes intentId is passed as btcTxId but it contains an EVM 0x hash.
  const isBtcHash = btcTxId && !btcTxId.startsWith('0x') && btcTxId.length === 64;
  const validBtcTxId = isBtcHash ? btcTxId : null;
  const validEvmTxHash = evmTxHash || (btcTxId?.startsWith('0x') ? btcTxId : null);

  return (
    <div className="flex gap-4 mt-3">
      {validBtcTxId && (
        <a href={`${BTC_EXPLORER}/${validBtcTxId}`} target="_blank" rel="noopener noreferrer"
          className="text-xs hover:underline" style={{ color: 'var(--text-tertiary)' }}>
          BTC Explorer ↗
        </a>
      )}
      {validEvmTxHash && (
        <a href={`${EVM_EXPLORER}/${validEvmTxHash}`} target="_blank" rel="noopener noreferrer"
          className="text-xs hover:underline" style={{ color: 'var(--text-tertiary)' }}>
          Midl Explorer ↗
        </a>
      )}
    </div>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <div className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium" style={{ background: bg, color }}>
      {label}
    </div>
  );
}

export default function TransactionsPage() {
  const { accounts } = useAccounts();
  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);
  const { address: evmAddress } = useAccount();

  const { data: activity, isLoading } = useUserActivity(evmAddress);
  const purchases = activity?.purchases ?? [];
  const launchesCreated = activity?.launches ?? [];
  const nftLaunches = activity?.nftLaunches ?? [];
  const nftMints = activity?.nftMints ?? [];

  const hasActivity = purchases.length > 0 || launchesCreated.length > 0 || nftLaunches.length > 0 || nftMints.length > 0;

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display font-bold mb-1" style={{ fontSize: '2rem', color: 'var(--text-primary)' }}>
          Transaction Center
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Bitcoin-to-Midl transaction lifecycle · Real-time settlement tracking
        </p>
      </div>

      {/* Lifecycle explainer */}
      <div className="rounded-xl p-5 mb-8" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-tertiary)' }}>
          Transaction Lifecycle
        </h3>
        <div className="flex items-start gap-0">
          {LIFECYCLE_STEPS.map((step, i) => (
            <div key={step.label} className="flex-1 relative">
              {i < LIFECYCLE_STEPS.length - 1 && (
                <div className="absolute top-3 left-1/2 right-0 h-px" style={{ background: 'var(--bg-border)' }} />
              )}
              <div className="flex flex-col items-center text-center px-2 relative z-10">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-2"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-tertiary)' }}>
                  {i + 1}
                </div>
                <div className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>{step.label}</div>
                <div className="text-xs leading-tight" style={{ color: 'var(--text-tertiary)' }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* No wallet */}
      {!paymentAccount && (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--bg-surface)', border: '1px dashed var(--bg-border)' }}>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Connect your wallet to see your transactions</p>
          <div className="flex justify-center gap-3">
            <Link href="/launches" className="btn btn-primary text-sm">Buy Tokens</Link>
            <Link href="/create" className="btn btn-secondary text-sm">Create Launch</Link>
          </div>
        </div>
      )}

      {/* Loading */}
      {paymentAccount && isLoading && (
        <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between animate-pulse">
              <div className="space-y-2">
                <div className="h-3 w-32 rounded" style={{ background: 'var(--bg-elevated)' }} />
                <div className="h-2 w-48 rounded" style={{ background: 'var(--bg-elevated)' }} />
              </div>
              <div className="h-6 w-20 rounded-full" style={{ background: 'var(--bg-elevated)' }} />
            </div>
          ))}
        </div>
      )}

      {paymentAccount && !isLoading && (
        <div className="space-y-6">

          {/* Token Launches Created */}
          {launchesCreated.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Tokens Launched</h2>
              <div className="rounded-xl overflow-hidden divide-y" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderColor: 'var(--bg-border)' }}>
                {launchesCreated.map(launch => (
                  <div key={launch.tokenAddress} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            Token Launch — {launch.name} <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>${launch.symbol}</span>
                          </span>
                          <Link href={`/launch/${launch.tokenAddress}`} className="text-xs hover:underline" style={{ color: 'var(--orange-500)' }}>
                            View →
                          </Link>
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {new Date(launch.timestamp).toLocaleString()}
                        </div>
                        <ExplorerLinks btcTxId={launch.intentId} evmTxHash={launch.txHash} />
                      </div>
                      <Badge label="Created" color="var(--green-500)" bg="rgba(34,197,94,0.1)" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* NFT Collections Launched */}
          {nftLaunches.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>NFT Collections Launched</h2>
              <div className="rounded-xl overflow-hidden divide-y" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderColor: 'var(--bg-border)' }}>
                {nftLaunches.map(nft => (
                  <div key={nft.contractAddress} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            NFT Launch — {nft.name} <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>${nft.symbol}</span>
                          </span>
                          <Link href={`/nft/${nft.contractAddress}`} className="text-xs hover:underline" style={{ color: 'var(--orange-500)' }}>
                            View →
                          </Link>
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {new Date(nft.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <Badge label="Created" color="var(--green-500)" bg="rgba(34,197,94,0.1)" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Token Trades (BUY + SELL) */}
          {purchases.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Token Trades</h2>
              <div className="rounded-xl overflow-hidden divide-y" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderColor: 'var(--bg-border)' }}>
                {purchases.map(purchase => {
                  const isBuy = purchase.tradeType !== 'SELL';
                  return (
                    <div key={purchase.id} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {isBuy ? 'Token Purchase' : 'Token Sale'} — {purchase.launch.name}
                            </span>
                            <Link href={`/launch/${purchase.launch.tokenAddress}`} className="text-xs hover:underline" style={{ color: 'var(--orange-500)' }}>
                              View launch →
                            </Link>
                          </div>
                          <div className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                            {new Date(purchase.timestamp).toLocaleString()} · <span className="font-mono">{purchase.intentId.slice(0, 14)}…</span>
                          </div>
                          <div className="inline-flex items-center gap-4 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-elevated)' }}>
                            <span>
                              <span style={{ color: 'var(--text-tertiary)' }}>{isBuy ? 'Paid' : 'Received'} </span>
                              <span className="font-num font-medium" style={{ color: 'var(--text-primary)' }}>
                                {formatBTC(purchase.btcAmount || '0')} BTC
                              </span>
                            </span>
                            <span style={{ color: 'var(--text-tertiary)' }}>↔</span>
                            <span>
                              <span style={{ color: 'var(--text-tertiary)' }}>{isBuy ? 'Received' : 'Sent'} </span>
                              <span className="font-num font-medium" style={{ color: isBuy ? 'var(--green-500)' : 'var(--red-500)' }}>
                                {formatTokenAmount(purchase.tokenAmount)} {purchase.launch.symbol}
                              </span>
                            </span>
                          </div>
                          <ExplorerLinks btcTxId={purchase.intentId} evmTxHash={purchase.txHash} />
                        </div>
                        <Badge
                          label={isBuy ? 'Buy' : 'Sell'}
                          color={isBuy ? 'var(--green-500)' : 'var(--red-500)'}
                          bg={isBuy ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* NFT Mints */}
          {nftMints.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>NFT Mints</h2>
              <div className="rounded-xl overflow-hidden divide-y" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderColor: 'var(--bg-border)' }}>
                {nftMints.map(mint => (
                  <div key={mint.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            NFT Mint — {mint.launch.name} #{mint.tokenId}
                          </span>
                          <Link href={`/nft/${mint.launch.contractAddress}`} className="text-xs hover:underline" style={{ color: 'var(--orange-500)' }}>
                            View collection →
                          </Link>
                        </div>
                        <div className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                          {new Date(mint.createdAt).toLocaleString()}
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-elevated)' }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>Paid</span>
                          <span className="font-num font-medium" style={{ color: 'var(--text-primary)' }}>
                            {formatBTC((BigInt(mint.pricePaidSats || '0') / BigInt(10_000_000_000)).toString())} BTC
                          </span>
                        </div>
                        <ExplorerLinks btcTxId={mint.btcTxHash} evmTxHash={mint.txHash} />
                      </div>
                      <Badge label="Minted" color="var(--orange-500)" bg="var(--orange-glow)" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {!hasActivity && (
            <div className="rounded-xl p-12 text-center" style={{ background: 'var(--bg-surface)', border: '1px dashed var(--bg-border)' }}>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>No transactions yet</p>
              <div className="flex justify-center gap-3">
                <Link href="/launches" className="btn btn-primary text-sm">Buy Tokens</Link>
                <Link href="/create" className="btn btn-secondary text-sm">Create Launch</Link>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
