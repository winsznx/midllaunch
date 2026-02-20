'use client';
import { useEffect, useRef, useState } from 'react';

export function PriceDisplay({ value, suffix = '' }: { value: number; suffix?: string }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value > prev.current) setFlash('up');
    else if (value < prev.current) setFlash('down');
    prev.current = value;
    const t = setTimeout(() => setFlash(null), 1000);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span className={`font-mono font-medium transition-colors ${flash === 'up' ? 'price-up' : flash === 'down' ? 'price-down' : ''}`}>
      {value.toLocaleString()}{suffix}
    </span>
  );
}
