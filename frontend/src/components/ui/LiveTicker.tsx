'use client';

import { useEffect, useState } from 'react';
import { wsClient } from '@/lib/websocket/client';
import type { WebSocketMessage } from '@/types';
import { formatTokenAmount, formatBTC } from '@/lib/wallet';

interface TickerEvent {
  id: string;
  buyer: string;
  tokenSymbol: string;
  tokenAmount: string;
  btcAmount: string;
}

const SEED_EVENTS: TickerEvent[] = [
  { id: 'seed-1', buyer: 'bc1q...ab3f', tokenSymbol: 'MBTC', tokenAmount: '12500000000000000000000', btcAmount: '100000' },
  { id: 'seed-2', buyer: 'bc1q...7f2c', tokenSymbol: 'SBTC', tokenAmount: '5000000000000000000000',  btcAmount: '50000'  },
  { id: 'seed-3', buyer: 'bc1q...e91a', tokenSymbol: 'PBTC', tokenAmount: '9800000000000000000000',  btcAmount: '80000'  },
];

export function LiveTicker() {
  const [events, setEvents] = useState<TickerEvent[]>(SEED_EVENTS);

  useEffect(() => {
    const handler = (msg: WebSocketMessage) => {
      if (msg.type !== 'tokens_purchased') return;
      const d = msg.data as Record<string, string> | undefined;
      if (!d) return;
      setEvents(prev => [
        {
          id: `${Date.now()}`,
          buyer: d.buyer ? `${d.buyer.slice(0, 8)}...${d.buyer.slice(-4)}` : '???',
          tokenSymbol: d.symbol || '???',
          tokenAmount: d.tokenAmount || '0',
          btcAmount: d.btcAmount || '0',
        },
        ...prev.slice(0, 19),
      ]);
    };

    wsClient.on('tokens_purchased', handler);
    return () => wsClient.off('tokens_purchased', handler);
  }, []);

  const items = [...events, ...events];

  return (
    <div
      className="w-full overflow-hidden border-y"
      style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-surface)' }}
    >
      <div className="ticker-track py-2.5">
        {items.map((e, i) => (
          <span
            key={`${e.id}-${i}`}
            className="inline-flex items-center gap-1.5 px-6 text-xs whitespace-nowrap"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span style={{ color: 'var(--text-tertiary)' }}>{e.buyer}</span>
            <span>bought</span>
            <span className="font-num font-medium" style={{ color: 'var(--text-primary)' }}>
              {formatTokenAmount(e.tokenAmount)} {e.tokenSymbol}
            </span>
            <span>for</span>
            <span className="font-num font-medium" style={{ color: 'var(--orange-500)' }}>
              {formatBTC(e.btcAmount)} BTC
            </span>
            <span style={{ color: 'var(--bg-border)', margin: '0 8px' }}>•</span>
          </span>
        ))}
      </div>
    </div>
  );
}
