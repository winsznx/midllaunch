import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { LaunchStatus, Candle } from '@/types';

export function useLaunches(params?: {
  status?: LaunchStatus;
  sortBy?: 'newest' | 'price_low' | 'price_high' | 'trending' | 'near_cap';
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['launches', params],
    queryFn: () => apiClient.getLaunches(params),
  });
}

export function useLaunch(tokenAddress: string | undefined) {
  return useQuery({
    queryKey: ['launch', tokenAddress],
    queryFn: () => apiClient.getLaunch(tokenAddress!),
    enabled: !!tokenAddress,
  });
}

export function usePurchases(tokenAddress: string | undefined, params?: {
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['purchases', tokenAddress, params],
    queryFn: () => apiClient.getPurchases(tokenAddress!, params),
    enabled: !!tokenAddress,
  });
}


export function useUserHoldings(address: string | undefined) {
  return useQuery({
    queryKey: ['holdings', address],
    queryFn: () => apiClient.getUserHoldings(address!),
    enabled: !!address,
  });
}

export function useUserActivity(address: string | undefined) {
  return useQuery({
    queryKey: ['activity', address],
    queryFn: () => apiClient.getUserActivity(address!),
    enabled: !!address,
  });
}

export function useComments(tokenAddress: string | undefined, params?: { limit?: number }) {
  return useQuery({
    queryKey: ['comments', tokenAddress, params],
    queryFn: () => apiClient.getComments(tokenAddress!, params),
    enabled: !!tokenAddress,
    refetchInterval: 30_000,
  });
}

export function useGlobalStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => apiClient.getGlobalStats(),
    refetchInterval: 30_000,
  });
}

export function usePriceHistory(tokenAddress: string | undefined) {
  return useQuery({
    queryKey: ['price-history', tokenAddress],
    queryFn: () => apiClient.getPriceHistory(tokenAddress!),
    enabled: !!tokenAddress,
    staleTime: 30_000,
  });
}

export function useNftLaunches(params?: { limit?: number; sortBy?: 'newest' | 'market_cap' }) {
  return useQuery({
    queryKey: ['nft-launches', params],
    queryFn: () => apiClient.getNftLaunches(params),
    refetchInterval: 30_000,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => apiClient.searchLaunches(q),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });
}

export function useCandles(tokenAddress: string | undefined, interval: string): ReturnType<typeof useQuery<{ candles: Candle[]; interval: string }>> {
  return useQuery({
    queryKey: ['candles', tokenAddress, interval],
    queryFn: () => apiClient.getCandles(tokenAddress!, interval),
    enabled: !!tokenAddress,
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
}

export function useGlobalActivity(limit = 10) {
  return useQuery({
    queryKey: ['activity:global', limit],
    queryFn: () => apiClient.getGlobalActivity(limit),
    refetchInterval: 15_000,
  });
}
