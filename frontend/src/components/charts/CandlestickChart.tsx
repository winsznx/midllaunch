'use client';
import { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import type { Candle } from '@/types';

interface Props {
  candles: Candle[];
  height?: number;
}

export function CandlestickChart({ candles, height = 300 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(162, 148, 116, 0.8)',
        fontFamily: "'IBM Plex Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(42, 37, 32, 0.6)' },
        horzLines: { color: 'rgba(42, 37, 32, 0.6)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(249, 115, 22, 0.4)' },
        horzLine: { color: 'rgba(249, 115, 22, 0.4)' },
      },
      rightPriceScale: { borderColor: 'rgba(42, 37, 32, 0.6)' },
      timeScale: {
        borderColor: 'rgba(42, 37, 32, 0.6)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    candleSeries.setData(
      candles.map(c => ({
        // lightweight-charts needs time in seconds
        time: Math.floor(c.time / 1000) as unknown as import('lightweight-charts').Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [candles, height]);

  if (candles.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          No trade data yet — be the first buyer.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}
