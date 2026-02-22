'use client';

import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useLaunch, usePurchases, useComments, useCandles } from '@/lib/hooks/useLaunches';
import { CandlestickChart } from '@/components/charts/CandlestickChart';
import { StatPill } from '@/components/ui/StatPill';
import { BuyPanel } from '@/components/trading/BuyPanel';
import { SellPanel } from '@/components/trading/SellPanel';
import { apiClient } from '@/lib/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAccounts } from '@midl/react';
import { AddressPurpose } from '@midl/core';
import { formatTokenAmount, formatBTC } from '@/lib/wallet';
import { useState, useEffect, useRef } from 'react';
import { wsClient } from '@/lib/websocket/client';
import type { WebSocketMessage } from '@/types';
import { ipfsUriToHttp } from '@/lib/ipfs/upload';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { DetailHeaderSkeleton, ActivityFeedSkeleton } from '@/components/ui/Skeletons';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

// ── Bonding curve SVG chart ────────────────────────────────────────────────────

interface CurveChartProps {
  basePrice: string;
  priceIncrement: string;
  supplyCap: string;
  currentSupply: string;
}

const TOKEN_BASE = BigInt('1000000000000000000');

function BondingCurveChart({ basePrice, priceIncrement, supplyCap, currentSupply }: CurveChartProps) {
  const cap = Number(BigInt(supplyCap) / TOKEN_BASE) || 1;
  const base = parseFloat(formatBTC(basePrice));
  const incr = parseFloat(formatBTC(priceIncrement));
  const sold = Number(BigInt(currentSupply) / TOKEN_BASE);

  const W = 400;
  const H = 160;
  const PAD = { top: 8, right: 8, bottom: 24, left: 48 };

  const points = 60;
  const xs = Array.from({ length: points + 1 }, (_, i) => (i / points) * cap);
  const ys = xs.map(s => base + s * incr);
  const maxY = ys[ys.length - 1];

  const toSvgX = (s: number) =>
    PAD.left + ((s / cap) * (W - PAD.left - PAD.right));
  const toSvgY = (p: number) =>
    H - PAD.bottom - ((p / maxY) * (H - PAD.top - PAD.bottom));

  const linePts = xs.map((s, i) => `${toSvgX(s)},${toSvgY(ys[i])}`).join(' ');
  const fillPts = [
    `${toSvgX(0)},${H - PAD.bottom}`,
    ...xs.map((s, i) => `${toSvgX(s)},${toSvgY(ys[i])}`),
    `${toSvgX(cap)},${H - PAD.bottom}`,
  ].join(' ');

  const soldX = toSvgX(sold);
  const soldY = toSvgY(base + sold * incr);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    p: maxY * t,
    y: toSvgY(maxY * t),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--orange-500)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--orange-500)" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="curveSold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--green-500)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--green-500)" stopOpacity="0.02" />
        </linearGradient>
        <clipPath id="soldClip">
          <rect x={PAD.left} y={PAD.top} width={Math.max(0, soldX - PAD.left)} height={H - PAD.top - PAD.bottom} />
        </clipPath>
      </defs>

      {/* Y-axis ticks */}
      {yTicks.map(({ p, y }) => (
        <g key={p}>
          <line x1={PAD.left - 4} y1={y} x2={W - PAD.right} y2={y}
            stroke="var(--bg-border)" strokeWidth={0.5} />
          <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize={8}
            fill="var(--text-tertiary)">
            {p.toFixed(6)}
          </text>
        </g>
      ))}

      {/* Full area (unsold — orange) */}
      <polygon points={fillPts} fill="url(#curveFill)" />
      {/* Sold area (green overlay) */}
      <polygon points={fillPts} fill="url(#curveSold)" clipPath="url(#soldClip)" />
      {/* Curve line */}
      <polyline points={linePts} fill="none" stroke="var(--orange-500)" strokeWidth={1.5} />

      {/* Current supply marker */}
      {sold > 0 && (
        <>
          <line x1={soldX} y1={PAD.top} x2={soldX} y2={H - PAD.bottom}
            stroke="var(--green-500)" strokeWidth={1} strokeDasharray="3,2" />
          <circle cx={soldX} cy={soldY} r={3.5} fill="var(--green-500)" />
        </>
      )}

      {/* X-axis label */}
      <text x={(W + PAD.left - PAD.right) / 2} y={H - 2} textAnchor="middle"
        fontSize={8} fill="var(--text-tertiary)">
        Token Supply →
      </text>
    </svg>
  );
}

// PriceHistoryChart replaced by CandlestickChart (imported above)

// ── Live activity feed ─────────────────────────────────────────────────────────

interface ActivityEvent {
  id: string;
  buyer: string;
  tokenAmount: string;
  btcAmount: string;
  timestamp: number;
  isNew?: boolean;
}

function timeSince(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

// ── Comment thread ─────────────────────────────────────────────────────────────

function CommentThread({
  tokenAddress,
  authorAddress,
  symbol,
}: {
  tokenAddress: string;
  authorAddress?: string;
  symbol: string;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useComments(tokenAddress, { limit: 50 });
  const comments = data?.comments ?? [];

  const [body, setBody] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Invalidate comment cache when another user posts via WebSocket
  useEffect(() => {
    const handler = (msg: WebSocketMessage) => {
      if (msg.type !== 'comment_posted') return;
      const d = msg.data as Record<string, string> | undefined;
      if (d?.tokenAddress?.toLowerCase() === tokenAddress.toLowerCase()) {
        queryClient.invalidateQueries({ queryKey: ['comments', tokenAddress] });
      }
    };
    wsClient.on('comment_posted', handler);
    return () => wsClient.off('comment_posted', handler);
  }, [tokenAddress, queryClient]);

  const handleSubmit = async () => {
    if (!authorAddress || !body.trim()) return;
    setIsPosting(true);
    setPostError(null);
    try {
      await apiClient.postComment(tokenAddress, authorAddress, body.trim());
      setBody('');
      await queryClient.invalidateQueries({ queryKey: ['comments', tokenAddress] });
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
          Thread
        </h2>
        <span className="font-num text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Compose */}
      <div className="mb-5">
        {authorAddress ? (
          <div className="space-y-2">
            <textarea
              rows={3}
              value={body}
              onChange={e => setBody(e.target.value.slice(0, 500))}
              placeholder={`Say something about ${symbol}…`}
              className="input w-full resize-none text-sm"
              style={{ fontFamily: 'var(--font-body)' }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {body.length}/500
              </span>
              <button
                onClick={handleSubmit}
                disabled={isPosting || body.trim().length === 0}
                className="btn btn-primary text-xs px-4 py-1.5"
              >
                {isPosting ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 border-2 rounded-full animate-spin"
                      style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    Posting…
                  </span>
                ) : 'Post'}
              </button>
            </div>
            {postError && (
              <p className="text-xs" style={{ color: 'var(--red-500)' }}>{postError}</p>
            )}
          </div>
        ) : (
          <p className="text-xs py-3 text-center" style={{ color: 'var(--text-tertiary)' }}>
            Connect wallet to post a comment
          </p>
        )}
      </div>

      {/* Comment list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse space-y-1.5">
              <div className="h-3 w-24 rounded" style={{ background: 'var(--bg-elevated)' }} />
              <div className="h-10 rounded" style={{ background: 'var(--bg-elevated)' }} />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
          No comments yet. Start the conversation.
        </p>
      ) : (
        <div className="space-y-0">
          {comments.map(comment => (
            <div
              key={comment.id}
              className="py-3 border-b"
              style={{ borderColor: 'var(--bg-border)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs" style={{ color: 'var(--orange-500)' }}>
                  {comment.author.slice(0, 8)}…{comment.author.slice(-4)}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {timeSince(new Date(comment.timestamp).getTime())} ago
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {comment.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Detail tabs (Comments / Transactions / Holders) ───────────────────────────

import type { Launch as LaunchType, Purchase as PurchaseType } from '@/types';

function DetailTabs({
  launch,
  purchases,
  liveEvents,
  tokenAddress,
  authorAddress,
}: {
  launch: LaunchType & { currentSupply?: string; supplyCap: string };
  purchases: PurchaseType[];
  liveEvents: ActivityEvent[];
  tokenAddress: string;
  authorAddress?: string;
}) {
  const [activeTab, setActiveTab] = useState<'comments' | 'transactions' | 'holders'>('comments');

  // Compute holders from purchases
  const holdersMap = new Map<string, { tokens: bigint; btcSpent: bigint; count: number }>();
  [...purchases, ...liveEvents.map(e => ({ buyer: e.buyer, tokenAmount: e.tokenAmount, btcAmount: e.btcAmount, id: e.id }) as PurchaseType)].forEach(p => {
    const existing = holdersMap.get(p.buyer) ?? { tokens: BigInt(0), btcSpent: BigInt(0), count: 0 };
    holdersMap.set(p.buyer, {
      tokens: existing.tokens + BigInt(p.tokenAmount || '0'),
      btcSpent: existing.btcSpent + BigInt(p.btcAmount || '0'),
      count: existing.count + 1,
    });
  });
  const holders = Array.from(holdersMap.entries())
    .map(([addr, data]) => ({ addr, ...data }))
    .sort((a, b) => Number(b.tokens - a.tokens));
  const totalSupply = BigInt(launch.currentSupply || '0');

  const TABS = [
    { key: 'comments' as const, label: 'Comments' },
    { key: 'transactions' as const, label: 'Transactions' },
    { key: 'holders' as const, label: 'Holders' },
  ];

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: 'var(--bg-border)' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 py-3 text-xs font-medium transition-all"
            style={{
              color: activeTab === tab.key ? 'var(--orange-500)' : 'var(--text-tertiary)',
              borderBottom: activeTab === tab.key ? '2px solid var(--orange-500)' : '2px solid transparent',
              background: 'transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {activeTab === 'comments' && (
          <CommentThread tokenAddress={tokenAddress} authorAddress={authorAddress} symbol={launch.symbol} />
        )}

        {activeTab === 'transactions' && (
          <div className="overflow-x-auto">
            {purchases.length === 0 && liveEvents.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>No trades yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--bg-border)' }}>
                    <th className="text-left pb-2 font-medium">Type</th>
                    <th className="text-left pb-2 font-medium">Trader</th>
                    <th className="text-right pb-2 font-medium">BTC</th>
                    <th className="text-right pb-2 font-medium">Tokens</th>
                    <th className="text-right pb-2 font-medium">Time</th>
                    <th className="text-right pb-2 font-medium">TX</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...liveEvents.map(e => ({
                      id: e.id,
                      buyer: e.buyer,
                      btcAmount: e.btcAmount,
                      tokenAmount: e.tokenAmount,
                      timestamp: e.timestamp,
                      txHash: undefined as string | undefined,
                      tradeType: 'BUY' as const,
                      isNew: e.isNew,
                    })),
                    ...purchases.map(p => ({
                      id: p.id,
                      buyer: p.buyer,
                      btcAmount: p.btcAmount,
                      tokenAmount: p.tokenAmount,
                      timestamp: new Date(p.timestamp).getTime(),
                      txHash: p.txHash,
                      tradeType: (p.tradeType ?? 'BUY') as 'BUY' | 'SELL',
                      isNew: false,
                    })),
                  ]
                    .filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx)
                    .slice(0, 50)
                    .map(row => {
                      const isSell = row.tradeType === 'SELL';
                      return (
                      <tr
                        key={row.id}
                        className={row.isNew ? 'animate-slideInUp' : ''}
                        style={{ borderBottom: '1px solid var(--bg-border)' }}
                      >
                        <td className="py-2.5">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold"
                            style={{
                              background: isSell ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                              color: isSell ? 'var(--red-500)' : 'var(--green-500)',
                            }}
                          >
                            {isSell ? '↓ SELL' : '↑ BUY'}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {row.buyer.slice(0, 8)}…{row.buyer.slice(-4)}
                        </td>
                        <td className="py-2.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>
                          {formatBTC(row.btcAmount)}
                        </td>
                        <td className="py-2.5 text-right font-mono" style={{ color: isSell ? 'var(--red-500)' : 'var(--green-500)' }}>
                          {isSell ? '-' : '+'}{formatTokenAmount(row.tokenAmount)}
                        </td>
                        <td className="py-2.5 text-right" style={{ color: 'var(--text-tertiary)' }}>
                          {timeSince(row.timestamp)}
                        </td>
                        <td className="py-2.5 text-right">
                          {row.txHash ? (
                            <a
                              href={`https://mempool.staging.midl.xyz/tx/${row.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                              style={{ color: 'var(--orange-500)' }}
                            >
                              ↗
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'holders' && (
          <div>
            {holders.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>No holders yet.</p>
            ) : (
              <div className="space-y-0">
                <div className="grid grid-cols-4 text-xs pb-2 mb-1" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--bg-border)' }}>
                  <span>#</span>
                  <span className="col-span-2">Address</span>
                  <span className="text-right">% Supply</span>
                </div>
                {holders.slice(0, 20).map((h, i) => {
                  const pct = totalSupply > BigInt(0)
                    ? (Number(h.tokens) / Number(totalSupply)) * 100
                    : 0;
                  return (
                    <div
                      key={h.addr}
                      className="grid grid-cols-4 items-center py-2.5 border-b text-xs"
                      style={{ borderColor: 'var(--bg-border)' }}
                    >
                      <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>#{i + 1}</span>
                      <span className="col-span-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {h.addr.slice(0, 8)}…{h.addr.slice(-4)}
                      </span>
                      <span className="text-right font-mono font-medium" style={{ color: 'var(--orange-500)' }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Progress bar ───────────────────────────────────────────────────────────────

function progressColor(pct: number) {
  if (pct >= 80) return 'var(--green-500)';
  if (pct >= 50) return '#eab308';
  return 'var(--orange-500)';
}

// ── Fully subscribed card ──────────────────────────────────────────────────────

function FullySubscribedCard({
  launch,
  lastTxHash,
}: {
  launch: LaunchType & { supplyCap: string; curveAddress: string; name: string };
  lastTxHash?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: `${launch.name} on MidlLaunch`, url }); } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const blockscoutHref = lastTxHash
    ? `https://blockscout.staging.midl.xyz/tx/${lastTxHash}`
    : `https://blockscout.staging.midl.xyz/address/${launch.curveAddress}`;

  return (
    <div
      className="rounded-xl p-6 text-center"
      style={{
        background: 'rgba(34,197,94,0.05)',
        border: '1px solid rgba(34,197,94,0.3)',
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="var(--green-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2 className="font-display font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
        This launch is complete
      </h2>
      <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        All {formatTokenAmount(launch.supplyCap)} tokens have been sold. The bonding curve is closed.
      </p>

      <div className="space-y-2">
        <a
          href={blockscoutHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary text-xs w-full"
          style={{ display: 'flex', justifyContent: 'center' }}
        >
          View on Blockscout \u2197
        </a>
        <button
          onClick={handleShare}
          className="btn btn-ghost text-xs w-full"
        >
          {copied ? 'Link copied' : 'Share'}
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LaunchDetailPage() {
  const params = useParams();
  const address = params.address as string;

  const { accounts } = useAccounts();
  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);

  const { data: launch, isLoading, error, refetch } = useLaunch(address);
  const { data: purchasesData, refetch: refetchPurchases } = usePurchases(address, { limit: 50 });
  const [chartMode, setChartMode] = useState<'curve' | 'candles'>('curve');
  const [timeframe, setTimeframe] = useState<'5m' | '1h' | '4h' | '1d'>('1h');
  const { data: chartData } = useCandles(address, timeframe);

  const [liveEvents, setLiveEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    if (!address) return;
    wsClient.subscribe(`launch:${address}`);

    const handlePurchase = (msg: WebSocketMessage) => {
      if (msg.type !== 'tokens_purchased') return;
      const d = msg.data as Record<string, string> | undefined;
      if (!d || d.tokenAddress?.toLowerCase() !== address.toLowerCase()) return;

      setLiveEvents(prev => [
        {
          id: `live-${Date.now()}`,
          buyer: d.buyer || '???',
          tokenAmount: d.tokenAmount || '0',
          btcAmount: d.btcAmount || '0',
          timestamp: Date.now(),
          isNew: true,
        },
        ...prev.slice(0, 29),
      ]);
      refetch();
      refetchPurchases();
    };

    const handleFinalized = (msg: WebSocketMessage) => {
      if (msg.type !== 'launch_finalized') return;
      const d = msg.data as Record<string, string> | undefined;
      if (!d || d.tokenAddress?.toLowerCase() !== address.toLowerCase()) return;
      confetti({
        particleCount: 120,
        spread: 80,
        colors: ['#f97316', '#22c55e', '#f5c518', '#ffffff'],
        origin: { y: 0.6 },
      });
      refetch();
    };

    wsClient.on('tokens_purchased', handlePurchase);
    wsClient.on('launch_finalized', handleFinalized);
    return () => {
      wsClient.unsubscribe(`launch:${address}`);
      wsClient.off('tokens_purchased', handlePurchase);
      wsClient.off('launch_finalized', handleFinalized);
    };
  }, [address, refetch, refetchPurchases]);

  // Graduation confetti — fires once when FINALIZED token loads
  useEffect(() => {
    if (!launch || launch.status !== 'FINALIZED') return;
    const end = Date.now() + 2000;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#f97316', '#fb923c', '#fbbf24'] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#f97316', '#fb923c', '#fbbf24'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [launch]);

  const [tradeTab, setTradeTab] = useState<'buy' | 'sell'>('buy');
  const [defaultBtcAmount, setDefaultBtcAmount] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const milestoneFiredRef = useRef<Set<number>>(new Set());

  // Milestone toasts at 25 / 50 / 75 %
  useEffect(() => {
    if (!launch) return;
    const pct = launch.currentSupply && launch.supplyCap
      ? Math.min(Number(BigInt(launch.currentSupply) * BigInt(10000) / BigInt(launch.supplyCap)) / 100, 100)
      : 0;
    const MILESTONES = [25, 50, 75] as const;
    for (const m of MILESTONES) {
      if (pct >= m && !milestoneFiredRef.current.has(m)) {
        milestoneFiredRef.current.add(m);
        toast(`${launch.symbol} is ${m}% sold!`);
      }
    }
  }, [launch]);

  // Pre-fill buy widget if creator has a pending dev buy
  useEffect(() => {
    if (!launch || !paymentAccount) return;
    if (launch.creator.toLowerCase() !== paymentAccount.address.toLowerCase()) return;
    try {
      const stored = sessionStorage.getItem('pendingDevBuy');
      if (!stored) return;
      const parsed = JSON.parse(stored) as { btcAmount: string; creator: string; at: number };
      if (
        parsed.creator.toLowerCase() === paymentAccount.address.toLowerCase() &&
        Date.now() - parsed.at < 10 * 60 * 1000
      ) {
        setDefaultBtcAmount(parsed.btcAmount);
        sessionStorage.removeItem('pendingDevBuy');
      }
    } catch {
      // ignore
    }
  }, [launch, paymentAccount]);

  // ── Loading / error ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="skeleton rounded h-4 w-24 mb-6" />
        <DetailHeaderSkeleton />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="skeleton rounded-xl" style={{ height: 80 }} />
            <div className="skeleton rounded-xl" style={{ height: 200 }} />
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
              <ActivityFeedSkeleton />
            </div>
          </div>
          <div className="skeleton rounded-xl" style={{ height: 400 }} />
        </div>
      </div>
    );
  }

  if (error || !launch) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div
          className="rounded-xl p-6"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red-500)' }}
        >
          <p className="font-semibold">Launch not found</p>
          <p className="text-sm mt-1">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <Link href="/launches" className="btn btn-secondary mt-4 inline-block text-sm">
            ← Back to Launches
          </Link>
        </div>
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const progress = launch.currentSupply && launch.supplyCap
    ? Math.min(Number(BigInt(launch.currentSupply) * BigInt(10000) / BigInt(launch.supplyCap)) / 100, 100)
    : 0;

  const imageUrl = launch.imageUrl || (launch.metadataUri ? ipfsUriToHttp(launch.metadataUri) : null);

  const purchases = purchasesData?.purchases ?? [];

  return (
    <div className="container mx-auto px-4 py-6 lg:py-10">
      <div className="flex items-center justify-between mb-5">
        <Link href="/launches" className="text-xs font-medium hover:underline"
          style={{ color: 'var(--orange-500)' }}>
          ← All Launches
        </Link>
        <button
          onClick={async () => {
            setIsRefreshing(true);
            await Promise.all([refetch(), refetchPurchases()]);
            setIsRefreshing(false);
          }}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--bg-border)' }}
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={isRefreshing ? 'animate-spin' : ''}
          >
            <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6 lg:mb-8">
        <div
          className="relative w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden"
          style={{
            background: imageUrl ? 'transparent' : `radial-gradient(ellipse, hsl(${Math.abs(launch.name.charCodeAt(0) * 5) % 360},60%,35%), hsl(${Math.abs(launch.name.charCodeAt(1) * 7) % 360},50%,15%))`,
          }}
        >
          {imageUrl && <Image src={imageUrl} alt={launch.name} fill sizes="64px" className="object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display font-bold text-2xl leading-none" style={{ color: 'var(--text-primary)' }}>
              {launch.name}
            </h1>
            <span className="font-mono text-sm" style={{ color: 'var(--text-tertiary)' }}>${launch.symbol}</span>
            {launch.status === 'ACTIVE' && (
              <span className="badge-live text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--red-500)' }}>
                <span className="pulse-dot" />LIVE
              </span>
            )}
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
            by <span className="font-mono">{launch.creator.slice(0, 10)}…{launch.creator.slice(-6)}</span>
          </p>
          {launch.description && (
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              {launch.description}
            </p>
          )}
          {(launch.twitterUrl || launch.telegramUrl || launch.websiteUrl) && (
            <div className="flex items-center gap-3 mt-2">
              {launch.twitterUrl && (
                <a href={launch.twitterUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium hover:underline"
                  style={{ color: 'var(--orange-500)' }}>𝕏 Twitter</a>
              )}
              {launch.telegramUrl && (
                <a href={launch.telegramUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium hover:underline"
                  style={{ color: 'var(--orange-500)' }}>✈ Telegram</a>
              )}
              {launch.websiteUrl && (
                <a href={launch.websiteUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium hover:underline"
                  style={{ color: 'var(--orange-500)' }}>🌐 Website</a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5 order-2 lg:order-1">

          {/* Stats */}
          {(() => {
            const currentPriceSats = parseFloat(launch.currentPrice ?? '0');
            const currentSupplyTokens = Number(BigInt(launch.currentSupply ?? '0') / TOKEN_BASE);
            const marketCapSats = currentPriceSats * currentSupplyTokens;
            const launchAge = timeSince(new Date(launch.timestamp).getTime());
            const stats = [
              { label: 'Current Price', value: `${formatBTC(launch.currentPrice ?? '0')} BTC`, accent: true },
              { label: 'Market Cap', value: `${formatBTC(marketCapSats.toFixed(0))} BTC`, accent: false },
              { label: 'Supply Sold', value: `${formatTokenAmount(launch.currentSupply ?? '0')} / ${formatTokenAmount(launch.supplyCap)}`, accent: false },
              { label: 'Total Volume', value: `${formatBTC(launch.totalBTCDeposited ?? '0')} BTC`, accent: false },
              { label: 'Age', value: launchAge, accent: false },
            ];
            return (
              <div
                className="grid gap-px grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-border)' }}
              >
                {stats.map(({ label, value, accent }) => (
                  <div key={label} className="py-4 px-4" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
                    <div className="font-num font-bold text-base" style={{ color: accent ? 'var(--orange-500)' : 'var(--text-primary)' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Volume metrics */}
          {(() => {
            const candles = chartData?.candles ?? [];
            const cutoff = Date.now() - 86_400_000;
            const volume24h = candles
              .filter(c => c.time > cutoff)
              .reduce((sum, c) => sum + c.volume, 0);
            const volumeTotal = candles.reduce((sum, c) => sum + c.volume, 0);
            const trades24h = purchases
              .filter(p => new Date(p.timestamp).getTime() > cutoff).length;
            const holders = new Set(purchases.map(p => p.buyer)).size;
            return (
              <div className="flex flex-wrap gap-2">
                <StatPill label="24h Volume" value={`\u20BF ${formatBTC(volume24h.toFixed(0))}`} />
                <StatPill label="Total Volume" value={`\u20BF ${formatBTC(volumeTotal.toFixed(0))}`} />
                <StatPill label="24h Trades" value={trades24h} />
                <StatPill label="Holders" value={holders} />
              </div>
            );
          })()}

          {/* Progress */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
          >
            <div className="flex justify-between text-xs mb-3">
              <span style={{ color: 'var(--text-secondary)' }}>Bonding Curve Progress</span>
              <span className="font-num font-medium" style={{ color: progressColor(progress) }}>
                {progress.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(progress, 100)}%`,
                  background: progressColor(progress),
                  transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            </div>
            <div className="flex justify-between text-xs mt-2">
              <span style={{ color: 'var(--text-tertiary)' }}>0</span>
              <span style={{ color: 'var(--text-tertiary)' }}>Graduation at 100%</span>
              <span style={{ color: 'var(--text-tertiary)' }}>{formatTokenAmount(launch.supplyCap)}</span>
            </div>
          </div>

          {/* Chart with tab switcher */}
          <ErrorBoundary>
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="flex gap-1 p-1 rounded-lg"
                  style={{ background: 'var(--bg-elevated)' }}
                >
                  <button
                    onClick={() => setChartMode('curve')}
                    className="px-3 py-1 rounded text-xs font-medium transition-all"
                    style={{
                      background: chartMode === 'curve' ? 'var(--bg-surface)' : 'transparent',
                      color: chartMode === 'curve' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    }}
                  >
                    Bonding Curve
                  </button>
                  <button
                    onClick={() => setChartMode('candles')}
                    className="px-3 py-1 rounded text-xs font-medium transition-all"
                    style={{
                      background: chartMode === 'candles' ? 'var(--bg-surface)' : 'transparent',
                      color: chartMode === 'candles' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    }}
                  >
                    Price
                  </button>
                </div>

                {chartMode === 'curve' && (
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 inline-block rounded" style={{ background: 'var(--green-500)' }} />
                      Sold
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 inline-block rounded" style={{ background: 'var(--orange-500)' }} />
                      Remaining
                    </span>
                  </div>
                )}

                {chartMode === 'candles' && (
                  <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
                    {(['5m', '1h', '4h', '1d'] as const).map(tf => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className="px-2.5 py-1 rounded text-xs font-medium transition-all"
                        style={{
                          background: timeframe === tf ? 'var(--orange-500)' : 'transparent',
                          color: timeframe === tf ? '#fff' : 'var(--text-tertiary)',
                          borderBottom: timeframe === tf ? '2px solid transparent' : '2px solid transparent',
                        }}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {chartMode === 'curve' ? (
                <BondingCurveChart
                  basePrice={launch.basePrice}
                  priceIncrement={launch.priceIncrement}
                  supplyCap={launch.supplyCap}
                  currentSupply={launch.currentSupply || '0'}
                />
              ) : (
                <CandlestickChart candles={chartData?.candles ?? []} height={280} />
              )}
            </div>
          </ErrorBoundary>

          {/* Tabbed section: Comments / Transactions / Holders */}
          <ErrorBoundary>
            <DetailTabs
              launch={launch}
              purchases={purchases}
              liveEvents={liveEvents}
              tokenAddress={address}
              authorAddress={paymentAccount?.address}
            />
          </ErrorBoundary>

          {/* Contract addresses */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
          >
            <h2 className="font-display font-bold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
              Contract Addresses
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Token', addr: launch.tokenAddress },
                { label: 'Bonding Curve', addr: launch.curveAddress },
              ].map(({ label, addr }) => (
                <div key={label}>
                  <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
                      {addr}
                    </code>
                    <a
                      href={`https://blockscout.staging.midl.xyz/address/${addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs flex-shrink-0 hover:underline"
                      style={{ color: 'var(--orange-500)' }}
                    >
                      ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Trade sidebar */}
        <div className="lg:sticky lg:top-20 order-1 lg:order-2 space-y-3">
          {progress >= 100 ? (
            <FullySubscribedCard
              launch={launch}
              lastTxHash={purchases.find(p => p.txHash)?.txHash}
            />
          ) : launch.status === 'ACTIVE' ? (
            <>
              {/* Buy / Sell tabs */}
              <div
                className="flex gap-1 p-1 rounded-xl"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
              >
                {(['buy', 'sell'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setTradeTab(tab)}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                    style={{
                      background: tradeTab === tab ? (tab === 'buy' ? 'var(--orange-500)' : 'var(--red-500)') : 'transparent',
                      color: tradeTab === tab ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {tab === 'buy' ? '↑ Buy' : '↓ Sell'}
                  </button>
                ))}
              </div>
              {tradeTab === 'buy' ? (
                <BuyPanel
                  launch={launch}
                  defaultBtcAmount={defaultBtcAmount || undefined}
                  onSuccess={() => { refetch(); refetchPurchases(); }}
                />
              ) : (
                <SellPanel
                  launch={launch}
                  onSuccess={() => { refetch(); refetchPurchases(); }}
                />
              )}
            </>
          ) : (
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
            >
              <h2 className="font-display font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
                Not yet active
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                This launch is pending activation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
