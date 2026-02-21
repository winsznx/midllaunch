export type LaunchStatus = 'ACTIVE' | 'FINALIZED';

export interface Launch {
  id: string;
  tokenAddress: string;
  curveAddress: string;
  creator: string;
  intentId: string;
  name: string;
  symbol: string;
  supplyCap: string;
  basePrice: string;
  priceIncrement: string;
  creatorFeeRate: number;
  status: LaunchStatus;
  blockNumber: string;
  txHash: string;
  timestamp: Date;
  currentSupply?: string;
  currentPrice?: string;
  totalBTCDeposited?: string;
  progress?: number;
  purchaseCount?: number;
  description?: string;
  metadataUri?: string;
  metadataCID?: string;
  imageUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  websiteUrl?: string;
  launchType?: string;
}

export interface Purchase {
  id: string;
  launchId: string;
  tradeType: 'BUY' | 'SELL';
  buyer: string;
  intentId: string;
  btcAmount: string;
  tokenAmount: string;
  newSupply: string;
  newPrice: string;
  blockNumber: string;
  txHash: string;
  btcTxHash?: string;
  timestamp: Date;
}

export interface ActivityPurchase extends Purchase {
  launch: {
    name: string;
    symbol: string;
    tokenAddress: string;
  };
}

export interface ActivityLaunch {
  tokenAddress: string;
  name: string;
  symbol: string;
  intentId: string | null;
  txHash: string;
  timestamp: Date;
  imageUrl: string | null;
}

export interface ActivityNftLaunch {
  contractAddress: string;
  name: string;
  symbol: string;
  createdAt: Date;
  imageUrl: string | null;
}

export interface ActivityNftMint {
  id: string;
  tokenId: number;
  pricePaidSats: string;
  txHash: string;
  btcTxHash: string | null;
  createdAt: Date;
  launch: {
    contractAddress: string;
    name: string;
    symbol: string;
    imageUrl: string | null;
  };
}

export interface UserHolding {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  balance: string;
  totalInvested: string;
  purchaseCount: number;
  avgBuyPriceSats: number;
  currentPriceSats: number;
  unrealizedPnlSats: number;
  unrealizedPnlPct: number;
}

export interface GlobalStats {
  totalLaunches: number;
  activeLaunches: number;
  finalizedLaunches: number;
  totalBTCDeposited: string;
  purchases24h: number;
  totalNFTLaunches: number;
  uniqueCreators: number;
  uniqueBuyers: number;
}

export interface WebSocketMessage {
  type: 'launch_created' | 'tokens_purchased' | 'tokens_sold' | 'price_update' | 'comment_posted' | 'nft_minted' | 'launch_finalized' | 'connected' | 'subscribed' | 'unsubscribed' | 'heartbeat' | 'pong';
  data?: Record<string, unknown>;
  channel?: string;
  timestamp?: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PricePoint {
  timestamp: number;
  price: string;
  supply: string;
}

export interface NftLaunchSummary {
  id: string;
  contractAddress: string;
  name: string;
  symbol: string;
  totalSupply: number;
  mintPrice: string;
  maxPerWallet: number;
  imageUrl?: string | null;
  description?: string | null;
  totalMinted: number;
  isFinalized: boolean;
  creatorAddress: string;
  createdAt: string;
}

export interface GlobalActivityEvent {
  type: 'purchase';
  launchAddress: string;
  tokenName: string;
  tokenSymbol: string;
  buyerAddress: string;
  amountSats: string;
  tokensReceived: string;
  txHash: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  launchId: string;
  author: string;
  body: string;
  timestamp: Date | string;
}


