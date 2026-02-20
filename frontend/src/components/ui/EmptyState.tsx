import { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="text-5xl mb-2">₿</div>
      <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {description && (
        <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      )}
      {action}
    </div>
  );
}
