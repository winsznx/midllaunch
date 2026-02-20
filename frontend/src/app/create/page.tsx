'use client';

import { useState, useRef, useCallback } from 'react';
import { useAccounts } from '@midl/react';
import { AddressPurpose } from '@midl/core';
import { useAddTxIntention, useSignIntention, useFinalizeBTCTransaction, useSendBTCTransactions } from '@midl/executor-react';
import { encodeFunctionData } from 'viem';
import { LAUNCH_FACTORY_ADDRESS, LAUNCH_FACTORY_ABI, ExecutionMode, btcToSatoshis, percentageToBasisPoints } from '@/lib/contracts/config';
import { uploadImageToIPFS, uploadMetadataToIPFS } from '@/lib/ipfs/upload';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TxProgress, type TxStep, type TxStepStatus } from '@/components/ui/TxProgress';

interface FormData {
  name: string;
  symbol: string;
  description: string;
  supplyCap: string;
  basePrice: string;
  priceIncrement: string;
  creatorFeeRate: string;
  twitter: string;
  telegram: string;
  website: string;
}

function tokenGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40 + Math.abs(hash >> 8) % 80) % 360;
  const h3 = (h2 + 60 + Math.abs(hash >> 16) % 60) % 360;
  return `radial-gradient(ellipse at 30% 30%, hsl(${h1},70%,35%), hsl(${h2},60%,20%) 50%, hsl(${h3},50%,10%))`;
}

export default function CreateLaunchPage() {
  const router = useRouter();
  const { accounts } = useAccounts();
  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    symbol: '',
    description: '',
    supplyCap: '1000000',
    basePrice: '0.00001',
    priceIncrement: '0.000001',
    creatorFeeRate: '1',
    twitter: '',
    telegram: '',
    website: '',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<'form' | 'uploading' | 'tx'>('form');
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [devBuyEnabled, setDevBuyEnabled] = useState(false);
  const [devBuyAmount, setDevBuyAmount] = useState('0.001');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TxProgress state
  const [showProgress, setShowProgress] = useState(false);
  const [txActiveStep, setTxActiveStep] = useState(0);
  const [txError, setTxError] = useState<string | null>(null);
  const [btcTxId, setBtcTxId] = useState<string | undefined>();
  const [redirectAfterClose, setRedirectAfterClose] = useState<string | null>(null);

  const { addTxIntentionAsync } = useAddTxIntention();
  const { signIntentionAsync } = useSignIntention();
  const { finalizeBTCTransactionAsync } = useFinalizeBTCTransaction();
  const { sendBTCTransactionsAsync } = useSendBTCTransactions();

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10 MB'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const updateForm = (key: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAccount) { setError('Connect your wallet first'); return; }

    setError(null);

    // Validate against contract bounds before any network call
    const basePriceSats = btcToSatoshis(formData.basePrice);
    const priceIncrSats = btcToSatoshis(formData.priceIncrement);
    const supplyCap_ = parseInt(formData.supplyCap);
    if (basePriceSats < BigInt(1000) || basePriceSats > BigInt(1000000)) {
      setError('Base price must be between 0.00001 BTC (1,000 sats) and 0.01 BTC (1,000,000 sats)');
      return;
    }
    if (priceIncrSats < BigInt(1) || priceIncrSats > BigInt(10000)) {
      setError('Price increment must be between 0.00000001 BTC (1 sat) and 0.0001 BTC (10,000 sats)');
      return;
    }
    if (supplyCap_ < 1_000_000 || supplyCap_ > 21_000_000) {
      setError('Supply cap must be between 1,000,000 and 21,000,000 tokens');
      return;
    }

    setShowProgress(true);
    setTxError(null);
    setBtcTxId(undefined);
    // Step 0 = first active step (image upload if image, else queue intent)
    setTxActiveStep(imageFile ? 0 : 2);

    try {
      let metadataCID: string | undefined;

      if (imageFile) {
        setStep('uploading');
        setTxActiveStep(0);
        const imageCID = await uploadImageToIPFS(imageFile);

        setTxActiveStep(1);
        metadataCID = await uploadMetadataToIPFS({
          name: formData.name,
          symbol: formData.symbol,
          description: formData.description,
          image: `ipfs://${imageCID}`,
          external_url: formData.website || undefined,
          twitter: formData.twitter || undefined,
          telegram: formData.telegram || undefined,
        });
      }

      setStep('tx');
      setUploadProgress('');
      setTxActiveStep(2);

      const supplyCap = BigInt(formData.supplyCap) * BigInt('1000000000000000000');
      const basePrice = btcToSatoshis(formData.basePrice);
      const priceIncrement = btcToSatoshis(formData.priceIncrement);
      const creatorFeeRate = BigInt(percentageToBasisPoints(formData.creatorFeeRate));

      const data = encodeFunctionData({
        abi: LAUNCH_FACTORY_ABI,
        functionName: 'createLaunch',
        args: [
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          formData.name,
          formData.symbol,
          supplyCap,
          basePrice,
          priceIncrement,
          creatorFeeRate,
          ExecutionMode.Immediate,
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ],
      });

      const intention = await addTxIntentionAsync({
        intention: { evmTransaction: { to: LAUNCH_FACTORY_ADDRESS, data, value: BigInt(0) } },
        from: paymentAccount.address,
        reset: true,
      });
      setTxActiveStep(3);

      const fbtResult = await finalizeBTCTransactionAsync({ from: paymentAccount.address });
      setBtcTxId(fbtResult.tx.id);
      setTxActiveStep(4);

      const signedIntention = await signIntentionAsync({ txId: fbtResult.tx.id, intention });
      setTxActiveStep(5);

      // Store metadata CID on backend if we uploaded
      if (metadataCID) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/pending-metadata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              btcTxId: fbtResult.tx.id,
              metadataCID,
              name: formData.name,
              symbol: formData.symbol,
            }),
          });
        } catch {
          // Non-critical — metadata might not be linked immediately
        }
      }

      await sendBTCTransactionsAsync({
        serializedTransactions: [signedIntention],
        btcTransaction: fbtResult.tx.hex,
      });
      setTxActiveStep(6); // all done

      if (devBuyEnabled && parseFloat(devBuyAmount) > 0) {
        sessionStorage.setItem('pendingDevBuy', JSON.stringify({
          btcAmount: devBuyAmount,
          creator: paymentAccount.address,
          intentId: fbtResult.tx.id,
          at: Date.now(),
        }));
        setRedirectAfterClose('/launches');
      } else {
        setRedirectAfterClose('/transactions');
      }

    } catch (err) {
      console.error('Create launch error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to create launch';
      setTxError(msg);
      setStep('form');
      setUploadProgress('');
    }
  };

  const estimatedInitialPrice = parseFloat(formData.basePrice) || 0;
  const estimatedMaxPrice =
    estimatedInitialPrice + (parseFloat(formData.priceIncrement) || 0) * (parseInt(formData.supplyCap) || 0);

  const launchStepDefs = [
    { label: 'Upload image to IPFS', skip: !imageFile },
    { label: 'Pin metadata to IPFS', skip: !imageFile },
    { label: 'Queue deploy intent' },
    { label: 'Build BTC transaction', detail: btcTxId ? `${btcTxId.slice(0, 16)}…` : undefined },
    { label: 'Sign with wallet (BIP-322)' },
    { label: 'Broadcast to Midl Staging' },
  ].filter(s => !s.skip);

  const launchSteps: TxStep[] = launchStepDefs.map((s, i) => {
    let status: TxStepStatus = 'pending';
    if (i < txActiveStep) status = 'done';
    else if (i === txActiveStep) status = 'active';
    if (txError && i === txActiveStep) status = 'error';
    return { label: s.label, detail: s.detail, status };
  });

  if (!paymentAccount) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div
          className="inline-block rounded-2xl p-12"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
        >
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="font-display font-bold text-xl mb-2" style={{ color: 'var(--text-primary)' }}>
            Connect Wallet
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Connect your Bitcoin wallet to create a token launch
          </p>
          <Link href="/launches" className="btn btn-secondary text-sm">
            Browse Existing Launches
          </Link>
        </div>
      </div>
    );
  }

  const isSubmitting = step !== 'form';

  return (
    <>
    <TxProgress
      isOpen={showProgress}
      title={`Launching ${formData.name || 'Token'}`}
      subtitle={`$${formData.symbol || 'TOKEN'} · Midl Staging Network`}
      steps={launchSteps}
      error={txError}
      onClose={() => {
        setShowProgress(false);
        setTxError(null);
        setStep('form');
        if (redirectAfterClose) router.push(redirectAfterClose);
      }}
      successAction={btcTxId ? {
        label: 'View Transaction ↗',
        href: `https://mempool.staging.midl.xyz/tx/${btcTxId}`,
      } : undefined}
    />
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1
          className="font-display font-bold mb-1"
          style={{ fontSize: '2rem', color: 'var(--text-primary)' }}
        >
          Launch a Token
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Deploy a bonding curve token on Bitcoin L2 · Parameters are immutable after launch
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl p-4 mb-6 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red-500)' }}
        >
          {error}
        </div>
      )}

      {uploadProgress && (
        <div
          className="rounded-xl p-4 mb-6 text-sm flex items-center gap-3"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}
        >
          <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin flex-shrink-0"
            style={{ borderColor: 'var(--orange-500)', borderTopColor: 'transparent' }} />
          {uploadProgress}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">

          {/* Token Identity */}
          <section
            className="rounded-xl p-6"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
          >
            <h2 className="font-display font-bold text-base mb-5" style={{ color: 'var(--text-primary)' }}>
              Token Identity
            </h2>

            {/* Image Upload */}
            <div className="mb-5">
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
                style={{ color: 'var(--text-tertiary)' }}>
                Token Image
              </label>
              <div
                className="relative rounded-xl overflow-hidden cursor-pointer transition-all"
                style={{
                  height: '160px',
                  background: imagePreview
                    ? 'transparent'
                    : (formData.name ? tokenGradient(formData.name) : 'var(--bg-elevated)'),
                  border: isDragging
                    ? '2px dashed var(--orange-500)'
                    : '2px dashed var(--bg-border)',
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
              >
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <span className="text-2xl">🖼</span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Click or drag to upload · PNG, JPG, GIF · Max 10 MB
                    </span>
                  </div>
                )}
                {imagePreview && (
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(null); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                  style={{ color: 'var(--text-tertiary)' }}>
                  Token Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => updateForm('name', e.target.value)}
                  placeholder="Pepe Bitcoin"
                  required
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                  style={{ color: 'var(--text-tertiary)' }}>
                  Symbol * <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(3-10 chars)</span>
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={e => updateForm('symbol', e.target.value.toUpperCase())}
                  placeholder="PEPBTC"
                  required
                  maxLength={10}
                  className="input w-full"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                style={{ color: 'var(--text-tertiary)' }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={e => updateForm('description', e.target.value)}
                placeholder="What is this token about? Tell the community."
                rows={3}
                className="input w-full resize-none"
                style={{ lineHeight: '1.5' }}
              />
            </div>
          </section>

          {/* Social Links */}
          <section
            className="rounded-xl p-6"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
          >
            <h2 className="font-display font-bold text-base mb-5" style={{ color: 'var(--text-primary)' }}>
              Social Links <span className="font-normal text-sm" style={{ color: 'var(--text-tertiary)' }}>optional</span>
            </h2>
            <div className="space-y-4">
              {[
                { key: 'twitter' as const, label: 'Twitter / X', placeholder: 'https://twitter.com/yourtoken', icon: '𝕏' },
                { key: 'telegram' as const, label: 'Telegram', placeholder: 'https://t.me/yourtoken', icon: '✈' },
                { key: 'website' as const, label: 'Website', placeholder: 'https://yourtoken.xyz', icon: '🌐' },
              ].map(({ key, label, placeholder, icon }) => (
                <div key={key} className="relative">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                    style={{ color: 'var(--text-tertiary)' }}>
                    {label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none"
                      style={{ color: 'var(--text-tertiary)' }}>
                      {icon}
                    </span>
                    <input
                      type="url"
                      value={formData[key]}
                      onChange={e => updateForm(key, e.target.value)}
                      placeholder={placeholder}
                      className="input w-full"
                      style={{ paddingLeft: '2.25rem' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Bonding Curve */}
          <section
            className="rounded-xl p-6"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
          >
            <h2 className="font-display font-bold text-base mb-5" style={{ color: 'var(--text-primary)' }}>
              Bonding Curve Parameters
            </h2>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                    style={{ color: 'var(--text-tertiary)' }}>
                    Total Supply Cap *
                  </label>
                  <input
                    type="number"
                    value={formData.supplyCap}
                    onChange={e => updateForm('supplyCap', e.target.value)}
                    required min="1000000" max="21000000" step="1"
                    className="input w-full"
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    1,000,000 – 21,000,000 tokens
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                    style={{ color: 'var(--text-tertiary)' }}>
                    Creator Fee (0–10%) *
                  </label>
                  <input
                    type="number"
                    value={formData.creatorFeeRate}
                    onChange={e => updateForm('creatorFeeRate', e.target.value)}
                    required min="0" max="10" step="0.1"
                    className="input w-full"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                    style={{ color: 'var(--text-tertiary)' }}>
                    Base Price (BTC) *
                  </label>
                  <input
                    type="number"
                    value={formData.basePrice}
                    onChange={e => updateForm('basePrice', e.target.value)}
                    required min="0.00001" max="0.01" step="0.00000001"
                    className="input w-full"
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    0.00001 – 0.01 BTC (1,000 – 1,000,000 sats)
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                    style={{ color: 'var(--text-tertiary)' }}>
                    Price Increment (BTC/token) *
                  </label>
                  <input
                    type="number"
                    value={formData.priceIncrement}
                    onChange={e => updateForm('priceIncrement', e.target.value)}
                    required min="0.00000001" max="0.0001" step="0.00000001"
                    className="input w-full"
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    0.00000001 – 0.0001 BTC (1 – 10,000 sats)
                  </p>
                </div>
              </div>
              <div
                className="p-3 rounded-lg text-xs font-mono"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
              >
                price(n) = {formData.basePrice || '?'} + (n × {formData.priceIncrement || '?'}) BTC
              </div>
            </div>
          </section>

          {/* Dev buy */}
          <section
            className="rounded-xl p-6"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  First Buy
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  Reserve your tokens before anyone else can buy
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDevBuyEnabled(v => !v)}
                className="relative w-10 h-6 rounded-full transition-all flex-shrink-0"
                style={{ background: devBuyEnabled ? 'var(--orange-500)' : 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
                aria-label="Toggle first buy"
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                  style={{
                    background: '#fff',
                    left: devBuyEnabled ? 'calc(100% - 1.375rem)' : '1px',
                    transition: 'left 0.15s ease',
                  }}
                />
              </button>
            </div>

            {devBuyEnabled && (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                    style={{ color: 'var(--text-tertiary)' }}>
                    Amount to Spend (BTC)
                  </label>
                  <input
                    type="number"
                    step="0.00000001"
                    min="0.00001"
                    value={devBuyAmount}
                    onChange={e => setDevBuyAmount(e.target.value)}
                    className="input w-full"
                    placeholder="0.001"
                  />
                </div>
                <div className="flex gap-1.5">
                  {['0.001', '0.01', '0.1'].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDevBuyAmount(amt)}
                      className="flex-1 py-1 rounded-lg text-xs font-mono transition-all"
                      style={{
                        background: devBuyAmount === amt ? 'var(--orange-500)' : 'var(--bg-elevated)',
                        color: devBuyAmount === amt ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid var(--bg-border)',
                      }}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  After your launch is confirmed, you&apos;ll be directed to complete this purchase.
                </p>
              </div>
            )}
          </section>

          {/* Disclaimer */}
          <div
            className="rounded-xl p-4 text-xs"
            style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', color: 'var(--text-secondary)' }}
          >
            Bonding curve parameters are immutable after deployment · Creator fees collected automatically ·
            Settlement requires Bitcoin confirmation + Midl execution · Not financial advice
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !formData.name || !formData.symbol}
            className="btn btn-primary w-full py-3"
            style={{ fontSize: '1rem' }}
          >
            {step === 'uploading' ? 'Uploading to IPFS…' : step === 'tx' ? 'Awaiting wallet signature…' : 'Deploy Token Launch'}
          </button>
        </form>

        {/* Preview sidebar */}
        <div className="space-y-5">
          <div
            className="rounded-xl overflow-hidden sticky top-20"
            style={{ border: '1px solid var(--bg-border)' }}
          >
            {/* Preview image */}
            <div
              style={{
                height: '176px',
                background: imagePreview ? 'transparent' : (formData.name ? tokenGradient(formData.name) : 'var(--bg-elevated)'),
              }}
            >
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
              )}
            </div>

            <div className="p-5" style={{ background: 'var(--bg-surface)' }}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                    {formData.name || 'Token Name'}
                  </div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    ${formData.symbol || 'SYMBOL'}
                  </div>
                </div>
              </div>

              {formData.description && (
                <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {formData.description.slice(0, 100)}{formData.description.length > 100 ? '…' : ''}
                </p>
              )}

              <div className="mt-4 pt-4 space-y-2.5" style={{ borderTop: '1px solid var(--bg-border)' }}>
                {[
                  { label: 'Supply', value: parseInt(formData.supplyCap || '0').toLocaleString() },
                  { label: 'Start Price', value: `${estimatedInitialPrice.toFixed(8)} BTC` },
                  { label: 'Max Price', value: `${estimatedMaxPrice.toFixed(8)} BTC` },
                  { label: 'Creator Fee', value: `${formData.creatorFeeRate}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                    <span className="font-num" style={{ color: 'var(--text-secondary)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
