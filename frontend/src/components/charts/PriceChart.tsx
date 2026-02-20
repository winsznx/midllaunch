'use client';
import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface PricePoint {
  timestamp: number;
  price: number;
}

interface PriceChartProps {
  data: PricePoint[];
  timeframe: '1h' | '6h' | '24h' | '7d';
  onTimeframeChange?: (tf: '1h' | '6h' | '24h' | '7d') => void;
}

const TIMEFRAME_LABELS: Record<string, string> = { '1h': '1H', '6h': '6H', '24h': '24H', '7d': '7D' };
const TIMEFRAME_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

function formatTime(ts: number, tf: string): string {
  const d = new Date(ts);
  if (tf === '7d') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function PriceChart({ data, timeframe, onTimeframeChange }: PriceChartProps) {
  const cutoff = Date.now() - TIMEFRAME_MS[timeframe];
  const filtered = data.filter(d => d.timestamp >= cutoff);
  const displayed = filtered.length > 0 ? filtered : data;

  const chartData = displayed.map(d => ({
    ts: d.timestamp,
    price: d.price,
    label: formatTime(d.timestamp, timeframe),
  }));

  const [tf, setTf] = useState(timeframe);
  const handleTfChange = (newTf: '1h' | '6h' | '24h' | '7d') => {
    setTf(newTf);
    onTimeframeChange?.(newTf);
  };

  const minPrice = Math.min(...chartData.map(d => d.price));
  const maxPrice = Math.max(...chartData.map(d => d.price));
  const midPrice = (minPrice + maxPrice) / 2;

  return (
    <div className="w-full" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          Price History
        </span>
        <div className="flex gap-1">
          {(['1h', '6h', '24h', '7d'] as const).map(t => (
            <button
              key={t}
              onClick={() => handleTfChange(t)}
              className="px-2 py-1 rounded text-xs font-mono transition-all"
              style={{
                background: tf === t ? 'var(--orange-500)' : 'var(--bg-elevated)',
                color: tf === t ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {TIMEFRAME_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {chartData.length < 2 ? (
        <div className="flex items-center justify-center h-40" style={{ color: 'var(--text-tertiary)' }}>
          <span className="text-sm">No price data yet</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--orange-500)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--orange-500)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[minPrice * 0.98, maxPrice * 1.02]}
              tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) => v.toFixed(6)}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-glass)',
                border: 'var(--glass-border)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-primary)',
              }}
              formatter={(value: number | undefined) => [(value ?? 0).toFixed(8) + ' BTC', 'Price']}
              labelStyle={{ color: 'var(--text-secondary)', marginBottom: 4 }}
            />
            <ReferenceLine y={midPrice} stroke="var(--bg-border)" strokeDasharray="2 2" />
            <Area
              type="monotone"
              dataKey="price"
              stroke="var(--orange-500)"
              strokeWidth={2}
              fill="url(#priceGrad)"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--orange-500)', stroke: 'var(--bg-base)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
