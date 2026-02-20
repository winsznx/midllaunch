import type {
  Launch,
  Purchase,
  ActivityPurchase,
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

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getLaunches(params?: {
    status?: 'ACTIVE' | 'FINALIZED';
    sortBy?: 'newest' | 'price_low' | 'price_high' | 'trending' | 'near_cap';
    limit?: number;
    offset?: number;
  }): Promise<{ launches: Launch[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const query = searchParams.toString();
    return this.fetch(`/api/launches${query ? `?${query}` : ''}`);
  }

  async getLaunch(tokenAddress: string): Promise<Launch> {
    return this.fetch(`/api/launches/${tokenAddress.toLowerCase()}`);
  }

  async getPurchases(tokenAddress: string, params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ purchases: Purchase[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const query = searchParams.toString();
    return this.fetch(
      `/api/launches/${tokenAddress.toLowerCase()}/purchases${query ? `?${query}` : ''}`
    );
  }

  async getUserHoldings(address: string): Promise<{ holdings: UserHolding[] }> {
    return this.fetch(`/api/user/${address.toLowerCase()}/holdings`);
  }

  async getUserActivity(address: string, params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ purchases: ActivityPurchase[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const query = searchParams.toString();
    return this.fetch(
      `/api/user/${address.toLowerCase()}/activity${query ? `?${query}` : ''}`
    );
  }

  async getGlobalStats(): Promise<GlobalStats> {
    return this.fetch('/api/stats');
  }

  async getGlobalActivity(limit = 10): Promise<{ events: GlobalActivityEvent[] }> {
    return this.fetch(`/api/activity?limit=${limit}`);
  }

  async getPriceHistory(tokenAddress: string): Promise<{ history: import('@/types').PricePoint[] }> {
    return this.fetch(`/api/launches/${tokenAddress.toLowerCase()}/price-history`);
  }

  async getNftLaunches(params?: {
    limit?: number;
    offset?: number;
    sortBy?: 'newest' | 'market_cap';
  }): Promise<{ launches: NftLaunchSummary[]; total: number }> {
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
  }): Promise<{ comments: Comment[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return this.fetch(
      `/api/launches/${tokenAddress.toLowerCase()}/comments${query ? `?${query}` : ''}`
    );
  }

  async postComment(tokenAddress: string, author: string, body: string): Promise<Comment> {
    return this.fetch(`/api/launches/${tokenAddress.toLowerCase()}/comments`, {
      method: 'POST',
      body: JSON.stringify({ author, body }),
    });
  }

  async getCandles(tokenAddress: string, interval: string): Promise<{ candles: Candle[]; interval: string }> {
    return this.fetch(`/api/launches/${tokenAddress.toLowerCase()}/chart?interval=${encodeURIComponent(interval)}`);
  }

  async searchLaunches(q: string): Promise<{ launches: Launch[] }> {
    return this.fetch(`/api/launches/search?q=${encodeURIComponent(q)}`);
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.fetch('/health');
  }
}

export const apiClient = new APIClient();
