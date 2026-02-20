'use client';

import { useEffect, useCallback } from 'react';
import { wsClient } from '@/lib/websocket/client';
import type { WebSocketMessage } from '@/types';

export function useWebSocket() {
  const handleLaunchCreated = useCallback((message: WebSocketMessage) => {
    if (message.data) {
      console.log('[WS] New launch created:', message.data);
    }
  }, []);

  const handleTokensPurchased = useCallback((message: WebSocketMessage) => {
    if (message.data && typeof message.data === 'object') {
      const data = message.data as {
        launchId?: string;
        newPrice?: string;
        newSupply?: string;
      };
      if (data.launchId) {
        console.log('[WS] Tokens purchased for launch:', data.launchId);
      }
    }
  }, []);

  const handlePriceUpdate = useCallback((message: WebSocketMessage) => {
    if (message.data && typeof message.data === 'object') {
      const data = message.data as {
        tokenAddress?: string;
        newPrice?: string;
        newSupply?: string;
      };
      if (data.tokenAddress) {
        console.log('[WS] Price update for:', data.tokenAddress);
      }
    }
  }, []);

  useEffect(() => {
    wsClient.connect().catch(console.error);
    wsClient.subscribe('global');

    wsClient.on('launch_created', handleLaunchCreated);
    wsClient.on('tokens_purchased', handleTokensPurchased);
    wsClient.on('price_update', handlePriceUpdate);

    return () => {
      wsClient.off('launch_created', handleLaunchCreated);
      wsClient.off('tokens_purchased', handleTokensPurchased);
      wsClient.off('price_update', handlePriceUpdate);
      wsClient.disconnect();
    };
  }, [handleLaunchCreated, handleTokensPurchased, handlePriceUpdate]);

  return {
    subscribeToLaunch: (tokenAddress: string) => {
      wsClient.subscribe(`launch:${tokenAddress}`);
    },
    unsubscribeFromLaunch: (tokenAddress: string) => {
      wsClient.unsubscribe(`launch:${tokenAddress}`);
    },
  };
}
