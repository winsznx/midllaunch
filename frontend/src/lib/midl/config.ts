import { type Config, MaestroSymphonyProvider, regtest } from '@midl/core';
import { createMidlConfig } from '@midl/satoshi-kit';

export const midlConfig = createMidlConfig({
  networks: [regtest],
  persist: true,
  runesProvider: new MaestroSymphonyProvider({ regtest: 'https://runes.staging.midl.xyz' }),
}) as Config;
