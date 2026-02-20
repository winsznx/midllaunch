export function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-sm px-4 py-3 flex flex-col gap-0.5">
      <span className="font-mono text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
      <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
    </div>
  );
}
