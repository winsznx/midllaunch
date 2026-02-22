'use client';
import { useState, useRef, useCallback } from 'react';
import { useAccounts, useWaitForTransaction } from '@midl/react';
import { AddressPurpose } from '@midl/core';
import { useAddTxIntention, useSignIntention, useFinalizeBTCTransaction } from '@midl/executor-react';
import { usePublicClient } from 'wagmi';
import { encodeFunctionData } from 'viem';
import { NFT_FACTORY_ABI, NFT_FACTORY_ADDRESS, btcToWei } from '@/lib/contracts/config';
import { uploadImageToIPFS, uploadMetadataToIPFS } from '@/lib/ipfs/upload';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { TxProgress, type TxStep } from '@/components/ui/TxProgress';
import { useRouter } from 'next/navigation';

type Step = 'identity' | 'params' | 'review';

interface FormState {
  name: string;
  symbol: string;
  description: string;
  imageFile: File | null;
  imagePreview: string;
  twitterUrl: string;
  telegramUrl: string;
  websiteUrl: string;
  totalSupply: number;
  mintPriceSats: number;
  maxPerWallet: number;
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'identity', label: 'Collection' },
  { key: 'params', label: 'Parameters' },
  { key: 'review', label: 'Deploy' },
];

const DEPLOY_STAGES: { label: string; activeDetail?: string }[] = [
  { label: 'Upload image to IPFS', activeDetail: 'Pinning image to IPFS network' },
  { label: 'Pin metadata to IPFS', activeDetail: 'Pinning collection metadata to IPFS' },
  { label: 'Queue deploy intent', activeDetail: 'Encoding createCollection calldata' },
  { label: 'Build BTC transaction', activeDetail: 'Wallet opening · Signing your UTXOs' },
  { label: 'Sign with wallet (BIP-322)', activeDetail: 'Linking EVM deploy intent to BTC tx' },
  { label: 'Broadcast to Bitcoin + Midl', activeDetail: 'Submitting both transactions to network' },
  { label: 'Awaiting settlement', activeDetail: 'BTC confirmation → contract deployment on Midl' },
];

function collectionGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 60 + Math.abs(hash >> 8) % 80) % 360;
  return `radial-gradient(ellipse at 30% 30%, hsl(${h1},60%,35%), hsl(${h2},50%,15%))`;
}

export default function LaunchNftPage() {
  const router = useRouter();
  const { accounts } = useAccounts();
  const paymentAccount = accounts?.find(acc => acc.purpose === AddressPurpose.Payment);

  const publicClient = usePublicClient();
  const { addTxIntentionAsync, txIntentions } = useAddTxIntention();
  const { signIntentionAsync } = useSignIntention();
  const { finalizeBTCTransactionAsync } = useFinalizeBTCTransaction();
  const { waitForTransactionAsync } = useWaitForTransaction();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [step, setStep] = useState<Step>('identity');
  const [form, setForm] = useState<FormState>({
    name: '',
    symbol: '',
    description: '',
    imageFile: null,
    imagePreview: '',
    twitterUrl: '',
    telegramUrl: '',
    websiteUrl: '',
    totalSupply: 1000,
    mintPriceSats: 10000,
    maxPerWallet: 5,
  });

  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStage, setDeployStage] = useState(-1);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [btcTxId, setBtcTxId] = useState<string | undefined>();
  const [deploySuccessSummary, setDeploySuccessSummary] = useState<string | undefined>();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    update('imageFile', file);
    update('imagePreview', URL.createObjectURL(file));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const maxRaiseBTC = ((form.mintPriceSats * form.totalSupply) / 1e8).toFixed(5);
  const canProceedIdentity = form.name.trim().length >= 2 && form.symbol.trim().length >= 1;
  const canProceedParams = form.totalSupply >= 1 && form.mintPriceSats >= 1000 && form.maxPerWallet >= 1;

  const handleDeploy = async () => {
    if (!paymentAccount) { setDeployError('Connect wallet first'); return; }

    setIsDeploying(true);
    setDeployError(null);
    setShowProgress(true);
    setBtcTxId(undefined);
    setDeployStage(0);

    try {
      let imageCID = '';
      let metadataCID = '';

      if (form.imageFile) {
        imageCID = await uploadImageToIPFS(form.imageFile);
      }
      setDeployStage(1);

      if (imageCID) {
        metadataCID = await uploadMetadataToIPFS({
          name: form.name,
          symbol: form.symbol,
          description: form.description,
          image: `ipfs://${imageCID}`,
          external_url: form.websiteUrl || undefined,
          twitter: form.twitterUrl || undefined,
          telegram: form.telegramUrl || undefined,
        });
      }
      setDeployStage(2);

      if (!NFT_FACTORY_ADDRESS) {
        setDeployStage(6);
        setDeployedAddress('0x0000000000000000000000000000000000000000');
        toast.success('NFT Collection deployed!');
        return;
      }

      const intentId = `0x${Date.now().toString(16).padStart(64, '0')}` as `0x${string}`;
      const mintPriceWei = btcToWei((form.mintPriceSats / 1e8).toFixed(10));

      const data = encodeFunctionData({
        abi: NFT_FACTORY_ABI,
        functionName: 'createCollection',
        args: [
          intentId,
          form.name,
          form.symbol.toUpperCase(),
          BigInt(form.totalSupply),
          mintPriceWei,
          BigInt(form.maxPerWallet),
          metadataCID,
        ],
      });

      const intention = await addTxIntentionAsync({
        intention: {
          evmTransaction: {
            to: NFT_FACTORY_ADDRESS,
            data,
            value: BigInt(0),
          },
        },
        from: paymentAccount.address,
        reset: true,
      });
      setDeployStage(3);

      const fbtResult = await finalizeBTCTransactionAsync({ from: paymentAccount.address });
      setBtcTxId(fbtResult.tx.id);
      setDeployStage(4);

      await signIntentionAsync({ txId: fbtResult.tx.id, intention });
      setDeployStage(5);

      await publicClient?.sendBTCTransactions({
        serializedTransactions: txIntentions.map(it => it.signedEvmTransaction as `0x${string}`),
        btcTransaction: fbtResult.tx.hex,
      });
      setDeployStage(6);

      await waitForTransactionAsync({ txId: fbtResult.tx.id });
      setDeployStage(7);
      setDeploySuccessSummary(`Deployed ${form.name} ($${form.symbol}) Collection`);
      window.dispatchEvent(new Event('midl:tx-success'));
      toast.success('NFT Collection deployed!');

      if (metadataCID) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/nft-launches/pending/metadata`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              metadataCID,
              imageUrl: imageCID ? `https://gateway.pinata.cloud/ipfs/${imageCID}` : undefined,
              description: form.description,
              twitterUrl: form.twitterUrl || undefined,
              telegramUrl: form.telegramUrl || undefined,
              websiteUrl: form.websiteUrl || undefined,
            }),
          });
        } catch { /* metadata upload is non-critical */ }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deployment failed';
      setDeployError(msg);
      toast.error(msg);
    } finally {
      setIsDeploying(false);
    }
  };

  const stepIndex = STEPS.findIndex(s => s.key === step);

  const nftTxSteps: TxStep[] = DEPLOY_STAGES.map((s, i) => {
    const isDone = deployStage > i;
    const isActive = deployStage === i;
    const doneDetail = i === 3 && btcTxId ? `${btcTxId.slice(0, 20)}…` : undefined;
    return {
      label: s.label,
      detail: isDone ? doneDetail : isActive ? s.activeDetail : undefined,
      status: isDone ? 'done' : isActive ? (deployError ? 'error' : 'active') : 'pending',
    };
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
            Connect your Bitcoin wallet to launch an NFT collection
          </p>
          <Link href="/launches" className="btn btn-secondary text-sm">
            Browse Existing Launches
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
    <TxProgress
      isOpen={showProgress}
      title={`Deploying ${form.name || 'NFT Collection'}`}
      subtitle={`${form.symbol ? `$${form.symbol}` : ''} · Midl Staging Network`}
      steps={nftTxSteps}
      error={deployError}
      btcTxId={btcTxId}
      successSummary={deploySuccessSummary}
      onClose={() => {
        setShowProgress(false);
        setDeployError(null);
        if (deployStage >= 7) router.push('/launches');
      }}
    />
    <div className="container mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="font-display font-bold mb-1"
          style={{ fontSize: '2rem', color: 'var(--text-primary)' }}
        >
          Launch NFT Collection
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Deploy a Bitcoin-native NFT collection with bonding curve minting · Parameters are immutable after launch
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8 max-w-sm">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all"
                style={{
                  background: i <= stepIndex ? 'var(--orange-500)' : 'var(--bg-elevated)',
                  color: i <= stepIndex ? '#fff' : 'var(--text-tertiary)',
                }}
              >
                {i < stepIndex ? '✓' : i + 1}
              </div>
              <span className="text-xs mt-1 whitespace-nowrap" style={{ color: i === stepIndex ? 'var(--orange-500)' : 'var(--text-tertiary)' }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-2 mb-4"
                style={{ background: i < stepIndex ? 'var(--orange-500)' : 'var(--bg-border)' }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Form — col-span-2 */}
        <div className="lg:col-span-2 space-y-6">

          {/* Step 1: Collection Identity */}
          {step === 'identity' && (
            <>
              {/* Collection Identity */}
              <section
                className="rounded-xl p-6"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
              >
                <h2 className="font-display font-bold text-base mb-5" style={{ color: 'var(--text-primary)' }}>
                  Collection Identity
                </h2>

                {/* Image Upload */}
                <div className="mb-5">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
                    style={{ color: 'var(--text-tertiary)' }}>
                    Cover Image
                  </label>
                  <div
                    className="relative rounded-xl overflow-hidden cursor-pointer transition-all"
                    style={{
                      height: '160px',
                      background: form.imagePreview
                        ? 'transparent'
                        : (form.name ? collectionGradient(form.name) : 'var(--bg-elevated)'),
                      border: isDragging
                        ? '2px dashed var(--orange-500)'
                        : '2px dashed var(--bg-border)',
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                  >
                    {form.imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.imagePreview} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)' }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          Click or drag to upload · PNG, JPG, GIF · Max 10 MB
                        </span>
                      </div>
                    )}
                    {form.imagePreview && (
                      <button
                        type="button"
                        aria-label="Remove image"
                        onClick={e => { e.stopPropagation(); update('imageFile', null); update('imagePreview', ''); }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs"
                        style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
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
                      Collection Name *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => update('name', e.target.value)}
                      placeholder="My NFT Collection"
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                      style={{ color: 'var(--text-tertiary)' }}>
                      Symbol * <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(max 10 chars)</span>
                    </label>
                    <input
                      type="text"
                      value={form.symbol}
                      onChange={e => update('symbol', e.target.value.toUpperCase().slice(0, 10))}
                      placeholder="MYNFT"
                      className="input w-full font-mono"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                    style={{ color: 'var(--text-tertiary)' }}>
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={e => update('description', e.target.value.slice(0, 500))}
                    placeholder="Tell the world about your collection…"
                    rows={3}
                    className="input w-full resize-none"
                    style={{ lineHeight: '1.5' }}
                  />
                  <div className="text-xs text-right mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {form.description.length}/500
                  </div>
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
                    { key: 'twitterUrl' as const, label: 'Twitter / X', placeholder: 'https://twitter.com/...', icon: '𝕏' },
                    { key: 'telegramUrl' as const, label: 'Telegram', placeholder: 'https://t.me/...', icon: '✈' },
                    { key: 'websiteUrl' as const, label: 'Website', placeholder: 'https://...', icon: '🌐' },
                  ].map(({ key, label, placeholder, icon }) => (
                    <div key={key}>
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
                          value={form[key] as string}
                          onChange={e => update(key, e.target.value)}
                          placeholder={placeholder}
                          className="input w-full"
                          style={{ paddingLeft: '2.25rem' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <button
                onClick={() => setStep('params')}
                disabled={!canProceedIdentity}
                className="btn btn-primary w-full py-3"
              >
                Next: Mint Parameters →
              </button>
            </>
          )}

          {/* Step 2: Mint Parameters */}
          {step === 'params' && (
            <>
              <section
                className="rounded-xl p-6"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
              >
                <h2 className="font-display font-bold text-base mb-5" style={{ color: 'var(--text-primary)' }}>
                  Mint Parameters
                </h2>
                <div className="space-y-6">

                  {/* Total Supply */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}>Total Supply</label>
                      <span className="font-mono text-sm font-bold" style={{ color: 'var(--orange-500)' }}>
                        {form.totalSupply.toLocaleString()} NFTs
                      </span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={10000}
                      step={100}
                      value={form.totalSupply}
                      onChange={e => update('totalSupply', Number(e.target.value))}
                      className="w-full accent-orange-500"
                    />
                    <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      <span>100</span><span>10,000</span>
                    </div>
                  </div>

                  {/* Mint Price */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                      style={{ color: 'var(--text-tertiary)' }}>
                      Mint Price (sats) *
                    </label>
                    <input
                      type="number"
                      min={1000}
                      value={form.mintPriceSats}
                      onChange={e => update('mintPriceSats', Math.max(1000, Number(e.target.value)))}
                      className="input w-full font-mono"
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      = {(form.mintPriceSats / 1e8).toFixed(8)} BTC per NFT · min 1,000 sats
                    </p>
                  </div>

                  {/* Max Per Wallet */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}>Max Per Wallet</label>
                      <span className="font-mono text-sm font-bold" style={{ color: 'var(--orange-500)' }}>
                        {form.maxPerWallet}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={form.maxPerWallet}
                      onChange={e => update('maxPerWallet', Number(e.target.value))}
                      className="w-full accent-orange-500"
                    />
                    <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      <span>1</span><span>10</span>
                    </div>
                  </div>
                </div>
              </section>

              <div className="flex gap-3">
                <button onClick={() => setStep('identity')} className="btn btn-secondary flex-1 py-3">
                  ← Back
                </button>
                <button
                  onClick={() => setStep('review')}
                  disabled={!canProceedParams}
                  className="btn btn-primary flex-1 py-3"
                >
                  Next: Review →
                </button>
              </div>
            </>
          )}

          {/* Step 3: Review & Deploy */}
          {step === 'review' && (
            <>
              <section
                className="rounded-xl p-6"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
              >
                <h2 className="font-display font-bold text-base mb-5" style={{ color: 'var(--text-primary)' }}>
                  Review & Deploy
                </h2>

                <div
                  className="rounded-xl p-4 space-y-2 text-xs mb-5"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
                >
                  {[
                    ['Name', form.name],
                    ['Symbol', form.symbol],
                    ['Supply', `${form.totalSupply.toLocaleString()} NFTs`],
                    ['Mint Price', `${form.mintPriceSats.toLocaleString()} sats (${(form.mintPriceSats / 1e8).toFixed(8)} BTC)`],
                    ['Max Per Wallet', String(form.maxPerWallet)],
                    ['Max Raise', `₿ ${maxRaiseBTC}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{k}</span>
                      <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* No factory deployed notice */}
                {!NFT_FACTORY_ADDRESS && (
                  <div
                    className="rounded-xl p-4 text-xs mb-5"
                    style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', color: 'var(--orange-500)' }}
                  >
                    <strong>NFT Factory not yet deployed to staging.</strong> Once <code>NEXT_PUBLIC_NFT_FACTORY_ADDRESS</code> is set,
                    this button will trigger the live transaction. The deployment lifecycle will still be shown.
                  </div>
                )}

                {/* Deployment lifecycle */}
                {deployStage >= 0 && (
                  <div className="space-y-2 mb-5">
                    {DEPLOY_STAGES.map((stage, i) => (
                      <div key={stage.label} className="flex items-center gap-2 text-xs">
                        <span style={{ color: i < deployStage ? 'var(--green-500)' : i === deployStage ? 'var(--orange-500)' : 'var(--text-tertiary)' }}>
                          {i < deployStage ? '✓' : i === deployStage && isDeploying ? '›' : '○'}
                        </span>
                        <span style={{ color: i <= deployStage ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                          {stage.label}
                        </span>
                        {i === deployStage && isDeploying && <Spinner size={12} />}
                      </div>
                    ))}
                  </div>
                )}

                {deployStage === 6 && (
                  <div
                    className="rounded-xl p-4 text-center mb-5"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
                  >
                    <div className="text-2xl mb-1">🎉</div>
                    <div className="text-sm font-semibold mb-1" style={{ color: 'var(--green-500)' }}>Collection Deployed!</div>
                    {deployedAddress && deployedAddress !== '0x0000000000000000000000000000000000000000' && (
                      <a
                        href={`https://blockscout.staging.midl.xyz/address/${deployedAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs hover:underline"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        View on Explorer ↗
                      </a>
                    )}
                  </div>
                )}

                {deployError && (
                  <div
                    className="rounded-xl p-4 text-xs mb-5"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--red-500)' }}
                  >
                    {deployError}
                  </div>
                )}
              </section>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('params')}
                  disabled={isDeploying}
                  className="btn btn-secondary flex-1 py-3"
                >
                  ← Back
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={isDeploying || deployStage === 6}
                  className="btn btn-primary flex-1 py-3"
                >
                  {isDeploying ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner size={14} /> Deploying…
                    </span>
                  ) : deployStage === 6 ? '✓ Deployed' : 'Deploy Collection'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Live Preview Panel */}
        <div className="sticky top-20">
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-surface)' }}
          >
            {/* Image preview */}
            <div
              className="h-44 w-full"
              style={{
                background: form.imagePreview ? 'var(--bg-elevated)' : collectionGradient(form.name || 'NFT'),
              }}
            >
              {form.imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.imagePreview} alt="preview" className="w-full h-full object-cover" />
              )}
            </div>

            {/* Collection info */}
            <div className="p-4">
              <div className="mb-4">
                <div className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {form.name || 'Collection Name'}
                </div>
                <div className="font-mono text-xs mt-0.5" style={{ color: 'var(--orange-500)' }}>
                  {form.symbol || 'SYMBOL'}
                </div>
              </div>

              <div className="space-y-1.5">
                {[
                  { label: 'Supply', value: `${form.totalSupply.toLocaleString()} NFTs` },
                  { label: 'Mint Price', value: `${(form.mintPriceSats / 1e8).toFixed(8)} BTC` },
                  { label: 'Max / Wallet', value: `${form.maxPerWallet} NFTs` },
                  { label: 'Max Raise', value: `₿ ${maxRaiseBTC}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                    <span className="font-num font-medium" style={{ color: 'var(--text-secondary)' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Step progress */}
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--bg-border)' }}>
                <div className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Progress</div>
                <div className="flex gap-1">
                  {STEPS.map((s, i) => (
                    <div
                      key={s.key}
                      className="flex-1 h-1 rounded-full"
                      style={{
                        background: i <= stepIndex ? 'var(--orange-500)' : 'var(--bg-elevated)',
                      }}
                    />
                  ))}
                </div>
                <div className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  Step {stepIndex + 1} of {STEPS.length} — {STEPS[stepIndex].label}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
