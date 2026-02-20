'use client';

import { useState } from 'react';
import { useAccounts, useConnect } from '@midl/react';
import { AddressPurpose } from '@midl/core';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LinkXPage() {
  const { accounts } = useAccounts();
  const { connectors, connect } = useConnect({
    purposes: [AddressPurpose.Payment],
  });
  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);
  const btcAddress = paymentAccount?.address ?? '';

  const [handle, setHandle] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [linkedHandle, setLinkedHandle] = useState<string | null>(null);

  const cleanHandle = handle.toLowerCase().replace(/^@/, '');

  const handleSubmit = async () => {
    if (!cleanHandle) { setErrorMsg('Enter your X @handle'); return; }
    if (!btcAddress) { setErrorMsg('Connect your wallet first'); return; }

    setStatus('submitting');
    setErrorMsg('');

    const message = `Link @${cleanHandle} to MidlLaunch | ${btcAddress} | ${new Date().toISOString().slice(0, 10)}`;

    try {
      const res = await fetch(`${API_URL}/api/bot/link-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xHandle: cleanHandle,
          btcAddress,
          signedMessage: message,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to link wallet');
      }

      setLinkedHandle(cleanHandle);
      setStatus('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  };

  if (status === 'success' && linkedHandle) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div
          className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{
            background: 'var(--bg-glass)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            border: 'var(--glass-border)',
          }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
            style={{ background: 'rgba(34,197,94,0.15)', border: '1.5px solid var(--green-500)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--green-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Wallet Linked
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            @{linkedHandle} is now linked to your wallet.<br />
            You can now use @midllaunchbot on X.
          </p>
          <div
            className="w-full rounded-xl px-4 py-3 text-xs font-mono text-left break-all"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}
          >
            {btcAddress}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col gap-6"
        style={{
          background: 'var(--bg-glass)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          border: 'var(--glass-border)',
        }}
      >
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Link X Wallet
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Connect your X @handle to your Xverse wallet. Do this once — all bot commands will use your linked wallet.
          </p>
        </div>

        {/* Step 1: X handle */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
            X Handle
          </label>
          <div className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>@</span>
            <input
              type="text"
              value={handle}
              onChange={e => setHandle(e.target.value.replace(/^@/, ''))}
              placeholder="yourhandle"
              autoCapitalize="none"
              autoCorrect="off"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {/* Step 2: Wallet */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
            Wallet
          </label>
          {btcAddress ? (
            <div
              className="rounded-xl px-4 py-3 text-xs font-mono break-all flex items-center gap-2"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--green-500)' }} />
              {btcAddress}
            </div>
          ) : (
            <button
              onClick={() => connectors[0] && connect({ id: connectors[0].id })}
              className="btn btn-secondary text-sm w-full"
            >
              Connect Xverse
            </button>
          )}
        </div>

        {errorMsg && (
          <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red-500)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {errorMsg}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={status === 'submitting' || !btcAddress || !cleanHandle}
          className="btn btn-primary w-full"
        >
          {status === 'submitting' ? 'Linking...' : 'Link Wallet'}
        </button>

        <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
          Non-custodial. Your keys stay in Xverse.
        </p>
      </div>
    </main>
  );
}
