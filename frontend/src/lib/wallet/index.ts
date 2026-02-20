'use client';

export function formatBTC(sats: string | number): string {
  const satoshis = typeof sats === 'string' ? parseInt(sats) : sats;
  return (satoshis / 100_000_000).toFixed(8);
}

export function formatTokenAmount(amount: string | number, decimals: number = 18): string {
  const amountBN = BigInt(typeof amount === 'string' ? amount : Math.floor(amount));
  const divisor = BigInt(10 ** decimals);
  const whole = amountBN / divisor;
  const remainder = amountBN % divisor;

  const remainderStr = remainder.toString().padStart(decimals, '0');
  const trimmed = remainderStr.replace(/0+$/, '');

  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

