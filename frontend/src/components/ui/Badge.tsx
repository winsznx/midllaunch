import { ReactNode } from 'react';

export function Badge({ type, children }: { type: 'live' | 'orange' | 'green' | 'red'; children: ReactNode }) {
  const cls: Record<typeof type, string> = {
    live: 'badge-live',
    orange: 'badge-orange',
    green: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium',
    red: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium',
  };
  const style: Record<typeof type, React.CSSProperties> = {
    live: {},
    orange: {},
    green: { background: 'var(--green-dim)', color: 'var(--green-500)', border: '1px solid rgba(34,197,94,0.2)' },
    red: { background: 'var(--red-dim)', color: 'var(--red-500)', border: '1px solid rgba(239,68,68,0.2)' },
  };
  return <span className={cls[type]} style={style[type]}>{children}</span>;
}
