export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const level = pct < 40 ? 'low' : pct < 75 ? 'mid' : 'high';
  const colors = { low: 'var(--orange-500)', mid: 'var(--gold)', high: 'var(--green-500)' } as const;

  return (
    <div className="progress-bar-container">
      <div
        className="progress-bar-fill"
        style={{ width: `${pct}%`, background: colors[level] }}
        data-level={level}
      />
    </div>
  );
}
