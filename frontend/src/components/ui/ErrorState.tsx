export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="glass p-8 flex flex-col items-center gap-4 text-center">
      <div className="text-3xl">⚠</div>
      <p style={{ color: 'var(--text-secondary)' }}>{message || 'Something went wrong'}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost text-sm">Try again</button>
      )}
    </div>
  );
}
