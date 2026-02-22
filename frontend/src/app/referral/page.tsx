'use client';

import { useState, useEffect } from 'react';
import { useAccounts } from '@midl/react';
import { AddressPurpose } from '@midl/core';
import { Copy, Check, Share2, Wallet, Gift, Info } from 'lucide-react';
import toast from 'react-hot-toast';

function AddressChip({ address }: { address: string }) {
  return (
    <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
      {address.slice(0, 6)}…{address.slice(-4)}
    </span>
  );
}

export default function ReferralPage() {
  const { accounts } = useAccounts();
  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const referralLink = paymentAccount && origin
    ? `${origin}/launches?ref=${paymentAccount.address}`
    : '';

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralLink) return;
    try {
      await navigator.share({ title: 'MidlLaunch', text: 'Trade memecoins on Bitcoin — join me on MidlLaunch!', url: referralLink });
    } catch {
      handleCopy();
    }
  };

  if (!paymentAccount) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
        >
          <Wallet size={40} className="mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
          <h2 className="font-display font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
            Connect your wallet
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Connect your Bitcoin wallet to get your unique referral link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <div
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full mb-3"
          style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--orange-500)', border: '1px solid rgba(249,115,22,0.3)' }}
        >
          <Gift size={11} />
          Referral Program
        </div>
        <h1 className="font-display font-bold text-3xl mb-2" style={{ color: 'var(--text-primary)' }}>
          Refer & Earn
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Share your unique link. When friends buy through your link, you earn a share of the creator fees on every trade they make.
        </p>
      </div>

      {/* Referral link card */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', boxShadow: '4px 4px 0 rgba(0,0,0,0.7)' }}
      >
        <div className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          Your Referral Link
        </div>
        <div
          className="flex items-center gap-2 p-3 rounded-xl mb-4 font-mono text-xs break-all"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}
        >
          <span className="flex-1 break-all">{referralLink}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
            style={{
              background: copied ? 'rgba(34,197,94,0.12)' : 'var(--orange-500)',
              color: copied ? 'var(--green-500)' : '#fff',
              border: copied ? '1px solid rgba(34,197,94,0.3)' : 'none',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--bg-border)' }}
          >
            <Share2 size={14} />
            Share
          </button>
        </div>
      </div>

      {/* How it works */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
      >
        <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>How it works</h2>
        <div className="space-y-4">
          {[
            {
              step: '01',
              title: 'Copy your link',
              description: 'Your unique referral link is tied to your Bitcoin wallet address.',
            },
            {
              step: '02',
              title: 'Share with friends',
              description: 'Share on Twitter, Telegram, or anywhere your community hangs out.',
            },
            {
              step: '03',
              title: 'Friends trade',
              description: 'When a friend clicks your link and buys tokens, your address is tracked as the referrer.',
            },
            {
              step: '04',
              title: 'Earn on every trade',
              description: 'You earn a portion of the protocol fee on every buy/sell made by users you referred.',
            },
          ].map(({ step, title, description }) => (
            <div key={step} className="flex gap-4">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold"
                style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--orange-500)', border: '1px solid rgba(249,115,22,0.3)' }}
              >
                {step}
              </div>
              <div>
                <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{title}</div>
                <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Your address */}
      <div
        className="rounded-2xl p-5 flex items-center gap-3"
        style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}
      >
        <Info size={16} style={{ color: 'var(--orange-500)', flexShrink: 0 }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Your referral ID is your wallet address{' '}
          <AddressChip address={paymentAccount.address} />.{' '}
          Referral earnings are distributed on-chain via the bonding curve fee mechanism.
          Earnings accumulate automatically — no claiming required.
        </p>
      </div>
    </div>
  );
}
