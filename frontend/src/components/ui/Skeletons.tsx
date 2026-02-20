export function TokenCardSkeleton() {
  return (
    <div className="token-card overflow-hidden" style={{ minHeight: 280 }}>
      <div className="skeleton" style={{ height: 160, width: '100%' }} />
      <div className="p-4 space-y-3">
        <div className="skeleton rounded" style={{ height: 16, width: '60%' }} />
        <div className="skeleton rounded" style={{ height: 14, width: '80%' }} />
        <div className="skeleton rounded" style={{ height: 4, width: '100%', borderRadius: 100 }} />
        <div className="skeleton rounded" style={{ height: 12, width: '50%' }} />
      </div>
    </div>
  );
}

export function DetailHeaderSkeleton() {
  return (
    <div className="flex items-start gap-5 mb-8 animate-pulse">
      <div className="skeleton w-16 h-16 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton rounded h-7 w-48" />
        <div className="skeleton rounded h-4 w-32" />
        <div className="skeleton rounded h-3 w-64" />
      </div>
    </div>
  );
}

export function ActivityFeedSkeleton() {
  return (
    <div className="space-y-0">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex justify-between items-center py-2.5 border-b animate-pulse"
          style={{ borderColor: 'var(--bg-border)' }}>
          <div className="skeleton rounded h-3 w-32" />
          <div className="skeleton rounded h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
