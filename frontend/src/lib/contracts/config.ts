import LaunchFactoryABI from './LaunchFactory.abi.json';
import BondingCurvePrimaryMarketABI from './BondingCurvePrimaryMarket.abi.json';
import NftFactoryABI from './NftFactory.abi.json';

// LaunchFactory contract address on Midl staging
export const LAUNCH_FACTORY_ADDRESS = (
  process.env.NEXT_PUBLIC_LAUNCH_FACTORY_ADDRESS ?? '0x5FbDB2315678afecb367f032d93F642f64180aa3'
) as `0x${string}`;

// Contract ABIs
export const LAUNCH_FACTORY_ABI = LaunchFactoryABI;
export const BONDING_CURVE_ABI = BondingCurvePrimaryMarketABI;
export const NFT_FACTORY_ABI = NftFactoryABI;

// NFT Factory contract address on Midl staging
export const NFT_FACTORY_ADDRESS = (
  process.env.NEXT_PUBLIC_NFT_FACTORY_ADDRESS ?? ''
) as `0x${string}`;

// ExecutionMode enum from contract
export enum ExecutionMode {
  Immediate = 0,
  Deferred = 1,
}

// Helper to convert BTC to wei (18 decimals)
export function btcToWei(btc: string): bigint {
  const parts = btc.split('.');
  const wholePart = parts[0] || '0';
  const fracPart = (parts[1] || '').padEnd(18, '0').slice(0, 18);
  return BigInt(wholePart + fracPart);
}

// Helper to convert BTC to satoshis (exact string arithmetic — avoids float64 precision loss)
export function btcToSatoshis(btc: string): bigint {
  const [whole, frac = ''] = btc.split('.');
  const fracPadded = frac.padEnd(8, '0').slice(0, 8);
  return BigInt(whole || '0') * BigInt(100_000_000) + BigInt(fracPadded || '0');
}

// Helper to convert percentage to basis points (100 = 1%)
export function percentageToBasisPoints(percentage: string): number {
  return Math.floor(parseFloat(percentage) * 100);
}
