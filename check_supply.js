const { ethers } = require('ethers');
const rpc = "https://rpc.staging.midl.xyz";
const provider = new ethers.JsonRpcProvider(rpc);
const curve = "0x8191a6c027b2929bf658b1736baedb36576d28b3";
const abi = ["function token() view returns (address)", "function calculatePurchaseReturn(uint256,uint256) view returns (uint256)"];
const contract = new ethers.Contract(curve, abi, provider);
async function main() {
  const tokenUrl = await contract.token();
  const tokenAbi = ["function totalSupply() view returns (uint256)"];
  const token = new ethers.Contract(tokenUrl, tokenAbi, provider);
  const supply = await token.totalSupply();
  console.log("On-chain supply:", supply.toString());

  const btcSats = 1000000n; // 0.01 BTC
  const estimatedTokens = await contract.calculatePurchaseReturn(btcSats, supply);
  console.log("Estimated tokens for 0.01 BTC with on-chain supply:", estimatedTokens.toString());

  // also check with supply 0
  const estZero = await contract.calculatePurchaseReturn(btcSats, 0);
  console.log("Estimated tokens for 0.01 BTC with 0 supply:", estZero.toString());
}
main().catch(console.error);
