import { type Config, MaestroSymphonyProvider, MempoolSpaceProvider, regtest } from '@midl/core';
import { createMidlConfig } from '@midl/satoshi-kit';

export const midlConfig = createMidlConfig({
  networks: [regtest],
  persist: true,
  runesProvider: new MaestroSymphonyProvider({ regtest: 'https://runes.staging.midl.xyz' }),
  mempoolProvider: new MempoolSpaceProvider({
    regtest: 'https://mempool.staging.midl.xyz/api',
    // Omit or fix websocket URL so it doesn't crash the frontend transaction watcher
    regtestWs: 'wss://mempool.staging.midl.xyz/api/v1/ws'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any) as Config;
