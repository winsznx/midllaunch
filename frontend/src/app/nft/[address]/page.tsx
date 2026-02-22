'use client';
import { useState, useEffect, use, useRef } from 'react';
import { useAccounts, useWaitForTransaction } from '@midl/react';
import { AddressPurpose } from '@midl/core';
import {
  useAddTxIntention,
  useSignIntention,
  useFinalizeBTCTransaction,
} from '@midl/executor-react';
import { useReadContract, usePublicClient } from 'wagmi';
import { encodeFunctionData } from 'viem';
import Link from 'next/link';
import {
  MIDL_NFT_ABI,
  NFT_MARKETPLACE_ABI,
  NFT_MARKETPLACE_ADDRESS,
  btcToWei,
} from '@/lib/contracts/config';
import { TxProgress, type TxStep } from '@/components/ui/TxProgress';
import { Spinner } from '@/components/ui/Spinner';
import type { NftLaunchSummary } from '@/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeMintSteps(activeStep: number, btcTxId?: string): TxStep[] {
  const labels: { label: string; detail?: string }[] = [
    { label: 'Queue mint intent' },
    { label: 'Build BTC transaction', detail: btcTxId ? `${btcTxId.slice(0, 16)}…` : undefined },
    { label: 'Sign with wallet (BIP-322)' },
    { label: 'Broadcast to Midl' },
  ];
  return labels.map((s, i) => ({
    label: s.label,
    detail: s.detail,
    status: i < activeStep ? 'done' : i === activeStep ? 'active' : 'pending',
  }));
}

function makeSecondarySteps(
  activeStep: number,
  label: string,
  btcTxId?: string,
): TxStep[] {
  const labels: { label: string; detail?: string }[] = [
    { label },
    { label: 'Build BTC transaction', detail: btcTxId ? `${btcTxId.slice(0, 16)}…` : undefined },
    { label: 'Sign with wallet (BIP-322)' },
    { label: 'Broadcast to Midl' },
  ];
  return labels.map((s, i) => ({
    label: s.label,
    detail: s.detail,
    status: i < activeStep ? 'done' : i === activeStep ? 'active' : 'pending',
  }));
}

function collectionGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) { h = seed.charCodeAt(i) + ((h << 5) - h); h |= 0; }
  const h1 = Math.abs(h) % 360;
  const h2 = (h1 + 70 + Math.abs(h >> 8) % 60) % 360;
  return `radial-gradient(ellipse at 30% 30%, hsl(${h1},55%,30%), hsl(${h2},45%,12%))`;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── secondary listing modal ─────────────────────────────────────────────────

interface ListModalProps {
  collection: string;
  tokenId: number;
  isOpen: boolean;
  onClose: () => void;
}

function ListModal({ collection, tokenId, isOpen, onClose }: ListModalProps) {
  const { accounts } = useAccounts();
  const paymentAccount = accounts?.find(a => a.purpose === AddressPurpose.Payment);
  const publicClient = usePublicClient();

  const { addTxIntentionAsync, txIntentions } = useAddTxIntention();
  const txIntentionsRef = useRef(txIntentions);
  useEffect(() => { txIntentionsRef.current = txIntentions; }, [txIntentions]);
  const { signIntentionAsync } = useSignIntention();
  const { finalizeBTCTransactionAsync } = useFinalizeBTCTransaction();

  const [priceSats, setPriceSats] = useState('');
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [btcTxId, setBtcTxId] = useState<string | undefined>();
  const [showProgress, setShowProgress] = useState(false);
  const [progressTitle, setProgressTitle] = useState('');
  const [progressLabel, setProgressLabel] = useState('');
  const [txError, setTxError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !paymentAccount || !publicClient || !NFT_MARKETPLACE_ADDRESS) return;
    let cancelled = false;
    publicClient.readContract({
      address: collection as `0x${string}`,
      abi: MIDL_NFT_ABI,
      functionName: 'isApprovedForAll',
      args: [paymentAccount.address as `0x${string}`, NFT_MARKETPLACE_ADDRESS],
    }).then((result) => {
      if (!cancelled) setIsApproved(result as boolean);
    }).catch(() => {
      if (!cancelled) setIsApproved(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, paymentAccount, publicClient, collection]);

  const runFlow = async (
    to: `0x${string}`,
    data: `0x${string}`,
    value: bigint,
    title: string,
    label: string,
  ) => {
    if (!paymentAccount) return;
    setProgressTitle(title);
    setProgressLabel(label);
    setActiveStep(0);
    setBtcTxId(undefined);
    setTxError(null);
    setShowProgress(true);

    const intention = await addTxIntentionAsync({
      intention: { evmTransaction: { to, data, value } },
      from: paymentAccount.address,
      reset: true,
    });
    setActiveStep(1);

    const fbt = await finalizeBTCTransactionAsync({ from: paymentAccount.address });
    setBtcTxId(fbt.tx.id);
    setActiveStep(2);

    await signIntentionAsync({ txId: fbt.tx.id, intention });
    setActiveStep(3);

    await publicClient?.sendBTCTransactions({
      serializedTransactions: txIntentionsRef.current.map(it => it.signedEvmTransaction as `0x${string}`),
      btcTransaction: fbt.tx.hex,
    });
    setActiveStep(4);
    return fbt.tx.id;
  };

  const handleApprove = async () => {
    try {
      const data = encodeFunctionData({
        abi: MIDL_NFT_ABI,
        functionName: 'setApprovalForAll',
        args: [NFT_MARKETPLACE_ADDRESS, true],
      });
      await runFlow(collection as `0x${string}`, data as `0x${string}`, BigInt(0), 'Approve Marketplace', 'Queue approval intent');
      setIsApproved(true);
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed');
    }
  };

  const handleList = async () => {
    if (!priceSats || parseFloat(priceSats) <= 0) return;
    try {
      const intentId = `0x${Date.now().toString(16).padStart(64, '0')}` as `0x${string}`;
      const priceSatsWei = btcToWei((parseInt(priceSats) / 1e8).toFixed(10));
      const data = encodeFunctionData({
        abi: NFT_MARKETPLACE_ABI,
        functionName: 'list',
        args: [intentId, collection as `0x${string}`, BigInt(tokenId), priceSatsWei],
      });
      await runFlow(
        NFT_MARKETPLACE_ADDRESS,
        data as `0x${string}`,
        BigInt(0),
        `List NFT #${tokenId}`,
        'Queue listing intent',
      );
      onClose();
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <TxProgress
        isOpen={showProgress}
        title={progressTitle}
        subtitle="Bitcoin-secured · Non-custodial"
        steps={makeSecondarySteps(activeStep, progressLabel, btcTxId)}
        error={txError ?? undefined}
        onClose={() => { setShowProgress(false); setTxError(null); }}
        successAction={btcTxId ? {
          label: 'View BTC Transaction ↗',
          href: `https://mempool.staging.midl.xyz/tx/${btcTxId}`,
        } : undefined}
      />
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-6 space-y-5"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              List NFT #{tokenId}
            </h3>
            <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {isApproved === null && (
            <div className="flex items-center justify-center py-4">
              <Spinner size={20} />
            </div>
          )}

          {isApproved === false && (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                First, approve the marketplace to transfer your NFTs on your behalf.
              </p>
              <button
                onClick={handleApprove}
                className="btn btn-primary w-full py-3 text-sm"
              >
                Approve Marketplace
              </button>
            </div>
          )}

          {isApproved === true && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                  style={{ color: 'var(--text-tertiary)' }}>
                  Price (sats)
                </label>
                <input
                  type="number"
                  value={priceSats}
                  onChange={e => setPriceSats(e.target.value)}
                  placeholder="10000"
                  min="1000"
                  className="input w-full font-mono"
                />
                {priceSats && parseInt(priceSats) > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    = {(parseInt(priceSats) / 1e8).toFixed(8)} BTC
                  </p>
                )}
              </div>
              <button
                onClick={handleList}
                disabled={!priceSats || parseInt(priceSats) <= 0}
                className="btn btn-primary w-full py-3 text-sm disabled:opacity-50"
              >
                List NFT #{tokenId}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

interface SecondaryListing {
  tokenId: number;
  seller: string;
  priceSats: bigint;
}

export default function NftCollectionPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { accounts } = useAccounts();
  const paymentAccount = accounts?.find(a => a.purpose === AddressPurpose.Payment);
  const publicClient = usePublicClient();

  const { addTxIntentionAsync, txIntentions } = useAddTxIntention();
  const txIntentionsRef = useRef(txIntentions);
  useEffect(() => { txIntentionsRef.current = txIntentions; }, [txIntentions]);
  const { signIntentionAsync } = useSignIntention();
  const { finalizeBTCTransactionAsync } = useFinalizeBTCTransaction();
  const { waitForTransactionAsync } = useWaitForTransaction();

  // ── API data ──
  const [collection, setCollection] = useState<NftLaunchSummary | null>(null);
  const [apiLoading, setApiLoading] = useState(true);

  useEffect(() => {
    setApiLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/nft-launches/${address}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: NftLaunchSummary | null) => setCollection(data))
      .catch(() => setCollection(null))
      .finally(() => setApiLoading(false));
  }, [address]);

  // ── on-chain reads ──
  const { data: onChainTotalSupply } = useReadContract({
    address: address as `0x${string}`,
    abi: MIDL_NFT_ABI,
    functionName: 'totalSupply',
  });
  const { data: onChainMaxSupply } = useReadContract({
    address: address as `0x${string}`,
    abi: MIDL_NFT_ABI,
    functionName: 'maxSupply',
  });
  const { data: onChainMintPrice } = useReadContract({
    address: address as `0x${string}`,
    abi: MIDL_NFT_ABI,
    functionName: 'mintPrice',
  });
  const { data: onChainMaxPerWallet } = useReadContract({
    address: address as `0x${string}`,
    abi: MIDL_NFT_ABI,
    functionName: 'maxPerWallet',
  });
  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    address: address as `0x${string}`,
    abi: MIDL_NFT_ABI,
    functionName: 'balanceOf',
    args: paymentAccount ? [paymentAccount.address as `0x${string}`] : undefined,
    query: { enabled: !!paymentAccount },
  });
  const { data: mintedByUser } = useReadContract({
    address: address as `0x${string}`,
    abi: MIDL_NFT_ABI,
    functionName: 'mintedPerWallet',
    args: paymentAccount ? [paymentAccount.address as `0x${string}`] : undefined,
    query: { enabled: !!paymentAccount },
  });

  const totalSupply = Number(onChainTotalSupply ?? collection?.totalMinted ?? 0);
  const maxSupply = Number(onChainMaxSupply ?? collection?.totalSupply ?? 0);
  const mintPrice: bigint = (onChainMintPrice as bigint | undefined) ?? BigInt(0);
  const maxPerWallet = Number(onChainMaxPerWallet ?? collection?.maxPerWallet ?? 1);
  const ownedCount = Number(userBalance ?? 0);
  const alreadyMinted = Number(mintedByUser ?? 0);

  // ── enumerate owned tokens + active listings ──
  const [ownedTokenIds, setOwnedTokenIds] = useState<number[]>([]);
  const [secondaryListings, setSecondaryListings] = useState<SecondaryListing[]>([]);
  const [enumerating, setEnumerating] = useState(false);

  useEffect(() => {
    if (!publicClient || totalSupply === 0) {
      setOwnedTokenIds([]);
      setSecondaryListings([]);
      return;
    }
    let cancelled = false;
    setEnumerating(true);

    const enumerate = async () => {
      const cap = Math.min(totalSupply, 200);
      const owned: number[] = [];
      const listed: SecondaryListing[] = [];

      const ownerCalls = Array.from({ length: cap }, (_, i) =>
        publicClient.readContract({
          address: address as `0x${string}`,
          abi: MIDL_NFT_ABI,
          functionName: 'ownerOf',
          args: [BigInt(i)],
        }).catch(() => null)
      );

      const listingCalls = NFT_MARKETPLACE_ADDRESS
        ? Array.from({ length: cap }, (_, i) =>
            publicClient.readContract({
              address: NFT_MARKETPLACE_ADDRESS,
              abi: NFT_MARKETPLACE_ABI,
              functionName: 'getListing',
              args: [address as `0x${string}`, BigInt(i)],
            }).catch(() => null)
          )
        : Array.from({ length: cap }, () => Promise.resolve(null));

      const [owners, listings] = await Promise.all([
        Promise.all(ownerCalls),
        Promise.all(listingCalls),
      ]);

      if (cancelled) return;

      for (let i = 0; i < cap; i++) {
        const owner = owners[i] as string | null;
        const listing = listings[i] as { seller: string; priceSats: bigint; active: boolean } | null;

        if (owner && paymentAccount && owner.toLowerCase() === paymentAccount.address.toLowerCase()) {
          owned.push(i);
        }
        if (listing?.active) {
          listed.push({ tokenId: i, seller: listing.seller, priceSats: listing.priceSats });
        }
      }

      setOwnedTokenIds(owned);
      setSecondaryListings(listed);
      setEnumerating(false);
    };

    enumerate();
    return () => { cancelled = true; };
  }, [address, totalSupply, paymentAccount, publicClient]);

  // ── mint flow ──
  const [quantity, setQuantity] = useState(1);
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintStep, setMintStep] = useState(0);
  const [mintBtcTxId, setMintBtcTxId] = useState<string | undefined>();
  const [showMintProgress, setShowMintProgress] = useState(false);
  const [mintSuccessSummary, setMintSuccessSummary] = useState<string | undefined>();

  const handleMint = async () => {
    if (!paymentAccount) { setMintError('Connect your wallet first'); return; }

    setIsMinting(true);
    setMintError(null);
    setMintStep(0);
    setMintBtcTxId(undefined);
    setMintSuccessSummary(undefined);
    setShowMintProgress(true);

    try {
      const intentId = `0x${Date.now().toString(16).padStart(64, '0')}` as `0x${string}`;
      const totalCost = mintPrice * BigInt(quantity);

      const data = encodeFunctionData({
        abi: MIDL_NFT_ABI,
        functionName: 'mint',
        args: [intentId, BigInt(quantity)],
      });

      const intention = await addTxIntentionAsync({
        intention: {
          evmTransaction: {
            to: address as `0x${string}`,
            data,
            value: totalCost,
          },
          deposit: {
            satoshis: Number(totalCost / BigInt(10_000_000_000)),
          },
        },
        from: paymentAccount.address,
        reset: true,
      });
      setMintStep(1);

      const fbt = await finalizeBTCTransactionAsync({ from: paymentAccount.address });
      setMintBtcTxId(fbt.tx.id);
      setMintStep(2);

      await signIntentionAsync({ txId: fbt.tx.id, intention });
      setMintStep(3);

      await publicClient?.sendBTCTransactions({
        serializedTransactions: txIntentionsRef.current.map(it => it.signedEvmTransaction as `0x${string}`),
        btcTransaction: fbt.tx.hex,
      });
      setMintStep(4);

      await waitForTransactionAsync({ txId: fbt.tx.id });
      setMintSuccessSummary(`Minted ${quantity} ${name} NFT${quantity > 1 ? 's' : ''}`);
      window.dispatchEvent(new Event('midl:tx-success'));
      refetchBalance();
    } catch (err) {
      setMintError(err instanceof Error ? err.message : 'Mint failed');
    } finally {
      setIsMinting(false);
    }
  };

  // ── secondary buy flow ──
  const [buyingTokenId, setBuyingTokenId] = useState<number | null>(null);
  const [buyStep, setBuyStep] = useState(0);
  const [buyBtcTxId, setBuyBtcTxId] = useState<string | undefined>();
  const [showBuyProgress, setShowBuyProgress] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buySuccessSummary, setBuySuccessSummary] = useState<string | undefined>();

  const handleBuySecondary = async (listing: SecondaryListing) => {
    if (!paymentAccount) return;
    setBuyingTokenId(listing.tokenId);
    setBuyStep(0);
    setBuyBtcTxId(undefined);
    setBuyError(null);
    setBuySuccessSummary(undefined);
    setShowBuyProgress(true);

    try {
      const intentId = `0x${Date.now().toString(16).padStart(64, '0')}` as `0x${string}`;
      const data = encodeFunctionData({
        abi: NFT_MARKETPLACE_ABI,
        functionName: 'buy',
        args: [intentId, address as `0x${string}`, BigInt(listing.tokenId)],
      });

      const intention = await addTxIntentionAsync({
        intention: {
          evmTransaction: {
            to: NFT_MARKETPLACE_ADDRESS,
            data,
            value: listing.priceSats,
          },
          deposit: {
            satoshis: Number(listing.priceSats / BigInt(10_000_000_000)),
          },
        },
        from: paymentAccount.address,
        reset: true,
      });
      setBuyStep(1);

      const fbt = await finalizeBTCTransactionAsync({ from: paymentAccount.address });
      setBuyBtcTxId(fbt.tx.id);
      setBuyStep(2);

      await signIntentionAsync({ txId: fbt.tx.id, intention });
      setBuyStep(3);

      await publicClient?.sendBTCTransactions({
        serializedTransactions: txIntentionsRef.current.map(it => it.signedEvmTransaction as `0x${string}`),
        btcTransaction: fbt.tx.hex,
      });
      setBuyStep(4);

      await waitForTransactionAsync({ txId: fbt.tx.id });
      setBuySuccessSummary(`Bought ${name} #${listing.tokenId}`);
      window.dispatchEvent(new Event('midl:tx-success'));
      refetchBalance();
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setBuyingTokenId(null);
    }
  };

  // ── delist flow ──
  const [delistingTokenId, setDelistingTokenId] = useState<number | null>(null);
  const [delistStep, setDelistStep] = useState(0);
  const [delistBtcTxId, setDelistBtcTxId] = useState<string | undefined>();
  const [showDelistProgress, setShowDelistProgress] = useState(false);
  const [delistError, setDelistError] = useState<string | null>(null);
  const [delistSuccessSummary, setDelistSuccessSummary] = useState<string | undefined>();

  const handleDelist = async (tokenId: number) => {
    if (!paymentAccount) return;
    setDelistingTokenId(tokenId);
    setDelistStep(0);
    setDelistBtcTxId(undefined);
    setDelistError(null);
    setDelistSuccessSummary(undefined);
    setShowDelistProgress(true);

    try {
      const data = encodeFunctionData({
        abi: NFT_MARKETPLACE_ABI,
        functionName: 'delist',
        args: [address as `0x${string}`, BigInt(tokenId)],
      });

      const intention = await addTxIntentionAsync({
        intention: {
          evmTransaction: {
            to: NFT_MARKETPLACE_ADDRESS,
            data,
            value: BigInt(0),
          },
        },
        from: paymentAccount.address,
        reset: true,
      });
      setDelistStep(1);

      const fbt = await finalizeBTCTransactionAsync({ from: paymentAccount.address });
      setDelistBtcTxId(fbt.tx.id);
      setDelistStep(2);

      await signIntentionAsync({ txId: fbt.tx.id, intention });
      setDelistStep(3);

      await publicClient?.sendBTCTransactions({
        serializedTransactions: txIntentionsRef.current.map(it => it.signedEvmTransaction as `0x${string}`),
        btcTransaction: fbt.tx.hex,
      });
      setDelistStep(4);

      await waitForTransactionAsync({ txId: fbt.tx.id });
      setDelistSuccessSummary(`Delisted ${name} #${tokenId}`);
    } catch (err) {
      setDelistError(err instanceof Error ? err.message : 'Delist failed');
    } finally {
      setDelistingTokenId(null);
    }
  };

  // ── list modal ──
  const [listingTokenId, setListingTokenId] = useState<number | null>(null);

  // ── derived ──
  const progressPct = maxSupply > 0 ? Math.min(100, (totalSupply / maxSupply) * 100) : 0;
  const mintPriceBtc = Number(mintPrice) / 1e18;
  const totalCostBtc = mintPriceBtc * quantity;
  const canMint = alreadyMinted + quantity <= maxPerWallet && totalSupply + quantity <= maxSupply;


  const name = collection?.name ?? 'NFT Collection';
  const symbol = collection?.symbol ?? '';
  const imageUrl = collection?.imageUrl;
  const description = collection?.description;

  if (apiLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <>
      {/* Mint TxProgress */}
      <TxProgress
        isOpen={showMintProgress}
        title={`Minting ${name}`}
        subtitle={`${symbol ? `$${symbol}` : ''} · Bitcoin-secured`}
        steps={makeMintSteps(mintStep, mintBtcTxId)}
        error={mintError ?? undefined}
        successSummary={mintSuccessSummary}
        onClose={() => { setShowMintProgress(false); setMintError(null); }}
        successAction={mintBtcTxId ? {
          label: 'View BTC Transaction ↗',
          href: `https://mempool.staging.midl.xyz/tx/${mintBtcTxId}`,
        } : undefined}
      />

      {/* Buy secondary TxProgress */}
      <TxProgress
        isOpen={showBuyProgress}
        title={`Buying NFT #${buyingTokenId ?? ''}`}
        subtitle="Secondary market · Bitcoin-secured"
        steps={makeSecondarySteps(buyStep, 'Queue purchase intent', buyBtcTxId)}
        error={buyError ?? undefined}
        successSummary={buySuccessSummary}
        onClose={() => { setShowBuyProgress(false); setBuyError(null); setBuyingTokenId(null); }}
        successAction={buyBtcTxId ? {
          label: 'View BTC Transaction ↗',
          href: `https://mempool.staging.midl.xyz/tx/${buyBtcTxId}`,
        } : undefined}
      />

      {/* Delist TxProgress */}
      <TxProgress
        isOpen={showDelistProgress}
        title={`Delisting NFT #${delistingTokenId ?? ''}`}
        subtitle="Cancel secondary listing"
        steps={makeSecondarySteps(delistStep, 'Queue delist intent', delistBtcTxId)}
        error={delistError ?? undefined}
        successSummary={delistSuccessSummary}
        onClose={() => { setShowDelistProgress(false); setDelistError(null); setDelistingTokenId(null); }}
        successAction={delistBtcTxId ? {
          label: 'View BTC Transaction ↗',
          href: `https://mempool.staging.midl.xyz/tx/${delistBtcTxId}`,
        } : undefined}
      />

      {/* List modal */}
      {listingTokenId !== null && (
        <ListModal
          collection={address}
          tokenId={listingTokenId}
          isOpen
          onClose={() => setListingTokenId(null)}
        />
      )}

      {/* Hero banner */}
      <div
        className="w-full"
        style={{
          height: '220px',
          background: imageUrl ? 'var(--bg-base)' : collectionGradient(name),
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7) 100%)' }}
        />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="container mx-auto">
            <h1 className="font-display font-bold text-2xl text-white mb-0.5">{name}</h1>
            <div className="flex items-center gap-3">
              {symbol && (
                <span className="text-sm font-mono" style={{ color: 'var(--orange-500)' }}>
                  ${symbol}
                </span>
              )}
              {collection?.creatorAddress && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  by {shortAddr(collection.creatorAddress)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Supply progress bar */}
        <div
          className="rounded-xl p-4 mb-8"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              Minted
            </span>
            <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
              {totalSupply.toLocaleString()} / {maxSupply.toLocaleString()}
              {maxSupply > 0 && ` (${progressPct.toFixed(1)}%)`}
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: '6px', background: 'var(--bg-elevated)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: progressPct >= 100
                  ? 'var(--green-500)'
                  : 'linear-gradient(90deg, var(--orange-500), #f97316)',
              }}
            />
          </div>
          <div className="flex gap-6 mt-3">
            {[
              { label: 'Mint Price', value: `${mintPriceBtc.toFixed(8)} BTC` },
              { label: 'Max Supply', value: maxSupply.toLocaleString() },
              { label: 'Max / Wallet', value: `${maxPerWallet} NFTs` },
            ].map(({ label, value }) => (
              <div key={label} className="text-xs">
                <div className="font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {label}
                </div>
                <div className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-8">

            {/* Description */}
            {description && (
              <section
                className="rounded-xl p-6"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
              >
                <h2 className="font-display font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
                  About
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {description}
                </p>
              </section>
            )}

            {/* Your NFTs */}
            {paymentAccount && (
              <section
                className="rounded-xl p-6"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
              >
                <h2 className="font-display font-bold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  Your NFTs
                  {ownedCount > 0 && (
                    <span
                      className="text-xs font-mono px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--orange-500)', color: '#fff' }}
                    >
                      {ownedCount}
                    </span>
                  )}
                </h2>

                {enumerating ? (
                  <div className="flex items-center gap-2 text-sm py-4" style={{ color: 'var(--text-tertiary)' }}>
                    <Spinner size={14} /> Loading tokens…
                  </div>
                ) : ownedTokenIds.length === 0 ? (
                  <p className="text-sm py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
                    {ownedCount > 0
                      ? `You own ${ownedCount} NFT${ownedCount > 1 ? 's' : ''} from this collection.`
                      : "You don't own any NFTs from this collection yet."}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {ownedTokenIds.map(tokenId => {
                      const isListed = secondaryListings.some(l => l.tokenId === tokenId);
                      return (
                        <div
                          key={tokenId}
                          className="rounded-xl overflow-hidden"
                          style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)' }}
                        >
                          <div
                            className="h-28 w-full"
                            style={{ background: imageUrl ? 'var(--bg-base)' : collectionGradient(`${name}${tokenId}`) }}
                          >
                            {imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={imageUrl} alt={`#${tokenId}`} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="p-2">
                            <div className="text-xs font-mono font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                              #{tokenId}
                            </div>
                            {isListed ? (
                              <button
                                onClick={() => handleDelist(tokenId)}
                                className="w-full py-1 rounded text-xs transition-all hover:opacity-80"
                                style={{
                                  background: 'rgba(239,68,68,0.1)',
                                  color: 'var(--red-500)',
                                  border: '1px solid rgba(239,68,68,0.3)',
                                }}
                              >
                                Delist
                              </button>
                            ) : (
                              <button
                                onClick={() => setListingTokenId(tokenId)}
                                className="w-full py-1 rounded text-xs transition-all hover:opacity-80"
                                style={{
                                  background: 'var(--bg-surface)',
                                  color: 'var(--orange-500)',
                                  border: '1px solid var(--bg-border)',
                                }}
                              >
                                List
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Secondary market */}
            <section
              className="rounded-xl p-6"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
            >
              <h2 className="font-display font-bold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                Secondary Market
                {secondaryListings.length > 0 && (
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                  >
                    {secondaryListings.length} listed
                  </span>
                )}
              </h2>

              {!NFT_MARKETPLACE_ADDRESS ? (
                <p className="text-xs py-4" style={{ color: 'var(--text-tertiary)' }}>
                  Marketplace contract not deployed yet.
                </p>
              ) : enumerating ? (
                <div className="flex items-center gap-2 text-sm py-4" style={{ color: 'var(--text-tertiary)' }}>
                  <Spinner size={14} /> Loading listings…
                </div>
              ) : secondaryListings.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  No active listings right now.
                </p>
              ) : (
                <div className="space-y-2">
                  {secondaryListings.map(listing => {
                    const priceBtc = Number(listing.priceSats) / 1e18;
                    const isOwn = paymentAccount &&
                      listing.seller.toLowerCase() === paymentAccount.address.toLowerCase();
                    return (
                      <div
                        key={listing.tokenId}
                        className="flex items-center justify-between rounded-xl px-4 py-3"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex-shrink-0"
                            style={{ background: collectionGradient(`${name}${listing.tokenId}`) }}
                          />
                          <div>
                            <div className="text-xs font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                              #{listing.tokenId}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                              {isOwn ? 'Your listing' : `by ${shortAddr(listing.seller)}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                              {priceBtc.toFixed(8)} BTC
                            </div>
                          </div>
                          {isOwn ? (
                            <button
                              onClick={() => handleDelist(listing.tokenId)}
                              className="px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                              style={{
                                background: 'rgba(239,68,68,0.1)',
                                color: 'var(--red-500)',
                                border: '1px solid rgba(239,68,68,0.3)',
                              }}
                            >
                              Delist
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBuySecondary(listing)}
                              disabled={!paymentAccount}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                              style={{
                                background: 'var(--orange-500)',
                                color: '#fff',
                              }}
                            >
                              Buy
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right column — sticky mint panel */}
          <div className="sticky top-20">
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
            >
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                Mint NFT
              </h3>

              {totalSupply >= maxSupply && maxSupply > 0 ? (
                <div
                  className="rounded-xl p-4 text-center text-sm"
                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--green-500)' }}
                >
                  Sold out — {maxSupply.toLocaleString()} NFTs minted
                </div>
              ) : (
                <>
                  {/* Quantity */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                      style={{ color: 'var(--text-tertiary)' }}>
                      Quantity
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all hover:opacity-80"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--bg-border)' }}
                      >
                        −
                      </button>
                      <span className="flex-1 text-center font-mono font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity(q => Math.min(maxPerWallet - alreadyMinted, q + 1))}
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all hover:opacity-80"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--bg-border)' }}
                      >
                        +
                      </button>
                    </div>
                    {paymentAccount && alreadyMinted > 0 && (
                      <p className="text-xs mt-1.5 text-center" style={{ color: 'var(--text-tertiary)' }}>
                        {alreadyMinted} minted · {maxPerWallet - alreadyMinted} remaining per wallet
                      </p>
                    )}
                  </div>

                  {/* Cost breakdown */}
                  <div
                    className="rounded-xl p-3 space-y-2 text-xs"
                    style={{ background: 'var(--bg-elevated)' }}
                  >
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-tertiary)' }}>Price per NFT</span>
                      <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {mintPriceBtc.toFixed(8)} BTC
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-tertiary)' }}>Quantity</span>
                      <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>× {quantity}</span>
                    </div>
                    <div
                      className="flex justify-between pt-2"
                      style={{ borderTop: '1px solid var(--bg-border)' }}
                    >
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Total</span>
                      <span className="font-mono font-bold" style={{ color: 'var(--orange-500)' }}>
                        {totalCostBtc.toFixed(8)} BTC
                      </span>
                    </div>
                  </div>

                  {!paymentAccount ? (
                    <p className="text-xs text-center py-2" style={{ color: 'var(--text-tertiary)' }}>
                      Connect wallet to mint
                    </p>
                  ) : (
                    <button
                      onClick={handleMint}
                      disabled={isMinting || !canMint}
                      className="btn-primary w-full py-3 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isMinting ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
                            style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                          Minting…
                        </span>
                      ) : !canMint ? (
                        alreadyMinted >= maxPerWallet ? 'Wallet limit reached' : 'Not enough supply'
                      ) : (
                        `Mint ${quantity} NFT${quantity > 1 ? 's' : ''}`
                      )}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Collection details */}
            <div
              className="rounded-xl p-4 mt-4 space-y-2"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
            >
              <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Collection Info</p>
              {[
                ['Contract', shortAddr(address)],
                ['Creator', collection?.creatorAddress ? shortAddr(collection.creatorAddress) : '—'],
                ['Supply', `${totalSupply} / ${maxSupply}`],
                ['Mint Price', `${mintPriceBtc.toFixed(8)} BTC`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                  <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{value}</span>
                </div>
              ))}
              <div className="pt-2">
                <Link
                  href={`https://blockscout.staging.midl.xyz/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs hover:underline"
                  style={{ color: 'var(--orange-500)' }}
                >
                  View on Explorer ↗
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
