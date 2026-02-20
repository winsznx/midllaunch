import 'dotenv/config';
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@midl/hardhat-deploy";
import { MaestroSymphonyProvider, MempoolSpaceProvider } from "@midl/core";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    midlStaging: {
      url: process.env.MIDL_RPC_URL || "https://rpc.staging.midl.xyz",
      chainId: parseInt(process.env.MIDL_CHAIN_ID || "15001"),
    },
    hardhat: {
      chainId: 31337,
    },
  },
  midl: {
    path: "deployments",
    networks: {
      default: {
        mnemonic: "",
        network: "regtest",
      },
      midlStaging: {
        mnemonic: process.env.MNEMONIC || "",
        confirmationsRequired: 1,
        btcConfirmationsRequired: 1,
        hardhatNetwork: "midlStaging",
        network: "regtest",
        runesProviderFactory: () => new MaestroSymphonyProvider({ regtest: "https://runes.staging.midl.xyz" }),
        providerFactory: () => new MempoolSpaceProvider({ regtest: "https://mempool.staging.midl.xyz" }),
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
