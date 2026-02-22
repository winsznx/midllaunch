'use client';

import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

export type TxStepStatus = 'pending' | 'active' | 'done' | 'error';

export interface TxStep {
  label: string;
  detail?: string;
  status: TxStepStatus;
}

interface TxProgressProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  steps: TxStep[];
  error?: string | null;
  onClose?: () => void;
  btcTxId?: string;
  evmTxHash?: string;
  successSummary?: string;
  successAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

function StepIcon({ status }: { status: TxStepStatus }) {
  if (status === 'done') {
    return (
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid var(--green-500)' }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--green-500)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ border: '1.5px solid var(--orange-500)' }}
      >
        <div
          className="w-3 h-3 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--orange-500)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid var(--red-500)' }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--red-500)" strokeWidth="3" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </div>
    );
  }
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ border: '1.5px solid var(--bg-border)' }}
    >
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--bg-border)' }} />
    </div>
  );
}

const MEMPOOL = 'https://mempool.staging.midl.xyz/tx';

export function TxProgress({
  isOpen,
  title,
  subtitle,
  steps,
  error,
  onClose,
  btcTxId,
  evmTxHash,
  successSummary,
  successAction,
}: TxProgressProps) {
  const allDone = steps.length > 0 && steps.every(s => s.status === 'done');
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (!allDone || confettiFiredRef.current) return;
    confettiFiredRef.current = true;

    const end = Date.now() + 2500;
    const colors = ['#f97316', '#fb923c', '#fbbf24', '#ffffff', '#22c55e'];

    const burst = () => {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 70,
        origin: { x: 0 },
        colors,
        gravity: 1.1,
        drift: 0.4,
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 70,
        origin: { x: 1 },
        colors,
        gravity: 1.1,
        drift: -0.4,
      });
      if (Date.now() < end) requestAnimationFrame(burst);
    };
    burst();
  }, [allDone]);

  useEffect(() => {
    if (!isOpen) confettiFiredRef.current = false;
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
    >
      <div className="flex min-h-full items-start sm:items-center justify-center px-4 pt-10 pb-8">
        <div
          className="w-full max-w-sm rounded-2xl p-7 space-y-5"
          style={{
            maxHeight: 'calc(100dvh - 5rem)',
            overflowY: 'auto',
            background: 'var(--bg-glass)',
            backdropFilter: 'var(--glass-blur)',
            border: 'var(--glass-border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div>
            {allDone ? (
              <>
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)' }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="font-display font-bold text-xl" style={{ color: 'var(--text-primary)' }}>
                  {successSummary ?? 'Done!'}
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Transaction broadcast to Midl Staging
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: 'var(--orange-500)' }}
                  />
                  <h2 className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                    {title}
                  </h2>
                </div>
                {subtitle && (
                  <p className="text-xs ml-5" style={{ color: 'var(--text-tertiary)' }}>
                    {subtitle}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Steps */}
          <div className="relative space-y-0">
            <div
              className="absolute left-[9px] top-5 bottom-5 w-px"
              style={{ background: 'var(--bg-border)' }}
            />
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3 relative">
                  <StepIcon status={step.status} />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div
                      className="text-sm font-medium leading-snug"
                      style={{
                        color: step.status === 'pending'
                          ? 'var(--text-tertiary)'
                          : step.status === 'error'
                            ? 'var(--red-500)'
                            : 'var(--text-primary)',
                      }}
                    >
                      {step.label}
                    </div>
                    {step.detail && (
                      <div className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                        {step.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BTC Transaction info — shown as soon as we have a tx ID */}
          {btcTxId && (
            <div
              className="rounded-xl px-4 py-3 space-y-1.5"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  Bitcoin Transaction
                </span>
                <a
                  href={`${MEMPOOL}/${btcTxId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs hover:underline"
                  style={{ color: 'var(--orange-500)' }}
                >
                  Mempool ↗
                </a>
              </div>
              <div className="font-mono text-xs break-all" style={{ color: 'var(--text-secondary)' }}>
                {btcTxId}
              </div>
            </div>
          )}

          {/* EVM Transaction info */}
          {evmTxHash && (
            <div
              className="rounded-xl px-4 py-3 space-y-1.5"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  Midl Transaction
                </span>
                <a
                  href={`https://blockscout.staging.midl.xyz/tx/${evmTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs hover:underline"
                  style={{ color: 'var(--orange-500)' }}
                >
                  Explorer ↗
                </a>
              </div>
              <div className="font-mono text-xs break-all" style={{ color: 'var(--text-secondary)' }}>
                {evmTxHash.slice(0, 10)}...{evmTxHash.slice(-8)}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (() => {
            // Extract human-readable "Details: ..." from verbose RPC error strings
            const detailsMatch = error.match(/Details:\s*([\s\S]+?)(?:\s+Version:|$)/);
            const friendlyError = detailsMatch ? detailsMatch[1].trim() : error;
            const isVerboseRpc = error.includes('Request body:') || error.includes('RPC Request');
            return (
              <div
                className="rounded-xl p-3 text-xs leading-relaxed space-y-1.5"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <p className="font-semibold" style={{ color: 'var(--red-500)' }}>
                  Transaction failed
                </p>
                <p className="break-words" style={{ color: 'var(--red-500)' }}>
                  {friendlyError}
                </p>
                {isVerboseRpc && (
                  <details className="mt-1">
                    <summary className="cursor-pointer opacity-50 hover:opacity-80 select-none" style={{ color: 'var(--text-tertiary)' }}>
                      Full error
                    </summary>
                    <p className="mt-1 break-all font-mono text-[10px] opacity-60" style={{ color: 'var(--text-tertiary)' }}>
                      {error}
                    </p>
                  </details>
                )}
              </div>
            );
          })()}

          {/* Action buttons */}
          {(allDone || error) && (
            <div className="space-y-2 pt-1">
              {allDone && successAction && (
                successAction.href ? (
                  <a
                    href={successAction.href}
                    className="btn btn-primary w-full text-sm text-center block"
                  >
                    {successAction.label}
                  </a>
                ) : (
                  <button
                    onClick={successAction.onClick}
                    className="btn btn-primary w-full text-sm"
                  >
                    {successAction.label}
                  </button>
                )
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="btn btn-ghost w-full text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {allDone ? 'Close' : 'Dismiss'}
                </button>
              )}
            </div>
          )}

          {/* In-progress note */}
          {!allDone && !error && (
            <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
              Keep this tab open · Do not close your wallet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
