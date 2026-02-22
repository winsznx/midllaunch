import type {
  Launch,
  Purchase,
  ActivityPurchase,
  ActivityLaunch,
  ActivityNftLaunch,
  ActivityNftMint,
  UserHolding,
  GlobalStats,
  GlobalActivityEvent,
  NftLaunchSummary,
  Comment,
  Candle,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class APIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async getLaunches(params?: {
    status?: 'ACTIVE' | 'FINALIZED';
    sortBy?: 'newest' | 'price_low' | 'price_high' | 'trending' | 'near_cap';
    limit?: number;
    offset?: number;
  }): Promise<{ launches: Launch[]; total: number } | null> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const query = searchParams.toString();
    return this.fetch(`/api/launches${query ? `?${query}` : ''}`);
  }

  async getLaunch(tokenAddress: string): Promise<Launch | null> {
    return this.fetch(`/api/launches/${tokenAddress.toLowerCase()}`);
  }

  async getPurchases(tokenAddress: string, params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ purchases: Purchase[]; total: number } | null> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const query = searchParams.toString();
    return this.fetch(
      `/api/launches/${tokenAddress.toLowerCase()}/purchases${query ? `?${query}` : ''}`
    );
  }

  async getUserHoldings(address: string): Promise<{ holdings: UserHolding[] } | null> {
    return this.fetch(`/api/user/${address.toLowerCase()}/holdings`);
  }

  async getUserActivity(address: string, params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ purchases: ActivityPurchase[]; launches: ActivityLaunch[]; nftLaunches: ActivityNftLaunch[]; nftMints: ActivityNftMint[]; total: number } | null> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const query = searchParams.toString();
    return this.fetch(
      `/api/user/${address.toLowerCase()}/activity${query ? `?${query}` : ''}`
    );
  }

  async getGlobalStats(): Promise<GlobalStats | null> {
    return this.fetch('/api/stats');
  }

  async getGlobalActivity(limit = 10): Promise<{ events: GlobalActivityEvent[] } | null> {
    return this.fetch(`/api/activity?limit=${limit}`);
  }

  async getPriceHistory(tokenAddress: string): Promise<{ history: import('@/types').PricePoint[] } | null> {
    return this.fetch(`/api/launches/${tokenAddress.toLowerCase()}/price-history`);
  }

  async getNftLaunches(params?: {
    limit?: number;
    offset?: number;
    sortBy?: 'newest' | 'market_cap';
  }): Promise<{ launches: NftLaunchSummary[]; total: number } | null> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
    const query = searchParams.toString();
    return this.fetch(`/api/nft-launches${query ? `?${query}` : ''}`);
  }

  async getComments(tokenAddress: string, params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ comments: Comment[]; total: number } | null> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return this.fetch(
      `/api/launches/${tokenAddress.toLowerCase()}/comments${query ? `?${query}` : ''}`
    );
  }

  async postComment(tokenAddress: string, author: string, body: string): Promise<Comment | null> {
    return this.fetch(`/api/launches/${tokenAddress.toLowerCase()}/comments`, {
      method: 'POST',
      body: JSON.stringify({ author, body }),
    });
  }

  async postPendingPurchase(btcAddress: string, launchAddr: string, btcAmount: string): Promise<void> {
    await this.fetch('/api/pending-purchase', {
      method: 'POST',
      body: JSON.stringify({ btcAddress, launchAddr, btcAmount }),
    });
  }

  async getCandles(tokenAddress: string, interval: string): Promise<{ candles: Candle[]; interval: string } | null> {
    return this.fetch(`/api/launches/${tokenAddress.toLowerCase()}/chart?interval=${encodeURIComponent(interval)}`);
  }

  async searchLaunches(q: string): Promise<{ launches: Launch[] } | null> {
    return this.fetch(`/api/launches/search?q=${encodeURIComponent(q)}`);
  }

  async healthCheck(): Promise<{ status: string; timestamp: string } | null> {
    return this.fetch('/health');
  }
}

export const apiClient = new APIClient();
