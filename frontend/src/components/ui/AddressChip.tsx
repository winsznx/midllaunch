'use client';
import { useState } from 'react';

export function AddressChip({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const short = address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={copy}
      className="font-mono text-xs px-2 py-1 rounded-md transition-all hover:opacity-80"
      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--bg-border)' }}
      title={address}
    >
      {copied ? '✓ Copied' : short}
    </button>
  );
}
