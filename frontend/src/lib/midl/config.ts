import { createConfig, regtest } from '@midl/core';
import { xverseConnector, leatherConnector } from '@midl/connectors';

export const midlConfig = createConfig({
  networks: [regtest],
  connectors: [
    xverseConnector(),
    leatherConnector(),
  ],
  persist: true,
});
