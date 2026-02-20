'use client';

const TOKEN_BASE = BigInt('1000000000000000000');

interface BondingCurveVizProps {
  basePrice: string;
  priceIncrement: string;
  supplyCap: string;
  currentSupply: string;
}

function formatBTCLocal(sats: string): number {
  try { return Number(BigInt(sats)) / 1e8; } catch { return 0; }
}

export function BondingCurveViz({ basePrice, priceIncrement, supplyCap, currentSupply }: BondingCurveVizProps) {
  const cap = Number(BigInt(supplyCap) / TOKEN_BASE) || 1;
  const base = formatBTCLocal(basePrice);
  const incr = formatBTCLocal(priceIncrement);
  const sold = Number(BigInt(currentSupply) / TOKEN_BASE);

  const W = 400;
  const H = 160;
  const PAD = { top: 8, right: 8, bottom: 24, left: 48 };

  const points = 60;
  const xs = Array.from({ length: points + 1 }, (_, i) => (i / points) * cap);
  const ys = xs.map(s => base + s * incr);
  const maxY = ys[ys.length - 1] || 1;

  const toSvgX = (s: number) => PAD.left + (s / cap) * (W - PAD.left - PAD.right);
  const toSvgY = (p: number) => H - PAD.bottom - ((p / maxY) * (H - PAD.top - PAD.bottom));

  const linePts = xs.map((s, i) => `${toSvgX(s)},${toSvgY(ys[i])}`).join(' ');
  const fillPts = [
    `${toSvgX(0)},${H - PAD.bottom}`,
    ...xs.map((s, i) => `${toSvgX(s)},${toSvgY(ys[i])}`),
    `${toSvgX(cap)},${H - PAD.bottom}`,
  ].join(' ');

  const soldX = toSvgX(sold);
  const soldY = toSvgY(base + sold * incr);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ p: maxY * t, y: toSvgY(maxY * t) }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="bcvFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--orange-500)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--orange-500)" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="bcvSold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--green-500)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--green-500)" stopOpacity="0.02" />
        </linearGradient>
        <clipPath id="bcvSoldClip">
          <rect x={PAD.left} y={PAD.top} width={Math.max(0, soldX - PAD.left)} height={H - PAD.top - PAD.bottom} />
        </clipPath>
      </defs>

      {yTicks.map(({ p, y }) => (
        <g key={p}>
          <line x1={PAD.left - 4} y1={y} x2={W - PAD.right} y2={y} stroke="var(--bg-border)" strokeWidth={0.5} />
          <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize={8} fill="var(--text-tertiary)">
            {p.toFixed(6)}
          </text>
        </g>
      ))}

      <polygon points={fillPts} fill="url(#bcvFill)" />
      <polygon points={fillPts} fill="url(#bcvSold)" clipPath="url(#bcvSoldClip)" />
      <polyline points={linePts} fill="none" stroke="var(--orange-500)" strokeWidth={1.5} />

      {sold > 0 && (
        <>
          <line x1={soldX} y1={PAD.top} x2={soldX} y2={H - PAD.bottom}
            stroke="var(--green-500)" strokeWidth={1} strokeDasharray="3,2" />
          <circle cx={soldX} cy={soldY} r={3.5} fill="var(--green-500)" />
          <text x={soldX + 5} y={PAD.top + 10} fontSize={7} fill="var(--green-500)">YOU ARE HERE</text>
        </>
      )}

      <text x={(W + PAD.left - PAD.right) / 2} y={H - 2} textAnchor="middle"
        fontSize={8} fill="var(--text-tertiary)">Token Supply →</text>
    </svg>
  );
}
