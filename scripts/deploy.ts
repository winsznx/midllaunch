import hre from "hardhat";
import { getDefaultAccount, getBalance } from "@midl/core";

async function main() {
  console.log("Deploying MidlLaunch to Midl Staging...\n");

  const protocolFeeRate = parseInt(process.env.PROTOCOL_FEE_RATE || "50");
  const feeRecipient = process.env.FEE_RECIPIENT;
  if (!feeRecipient) {
    throw new Error("FEE_RECIPIENT not set in .env — set it to your EVM deployer address");
  }

  console.log("Protocol fee rate:", protocolFeeRate, "bps");
  console.log("Fee recipient:", feeRecipient);
  console.log("");

  const midlConfig = await hre.midl.initialize();

  const account = getDefaultAccount(midlConfig);
  const btcAddress = account?.address;

  console.log("Deployer BTC address:", btcAddress ?? "(unknown)");

  if (btcAddress) {
    const balance = await getBalance(midlConfig, btcAddress);
    const confirmed = typeof balance === "number" ? balance : (balance as any)?.confirmed ?? 0;
    console.log("BTC balance:         ", confirmed, "sats confirmed");
    if (confirmed < 10000) {
      throw new Error(
        `Insufficient BTC. Need at least 10,000 sats.\nFund this address at https://faucet.midl.xyz:\n  ${btcAddress}`
      );
    }
  }

  console.log("\nDeploying LaunchFactory...");
  await hre.midl.deploy("LaunchFactory", [protocolFeeRate, feeRecipient], { gas: 5_000_000n });
  await hre.midl.execute();

  const deployment = await hre.midl.get("LaunchFactory");
  console.log("\nLaunchFactory deployed to:", deployment.address);
  console.log("EVM tx:", deployment.txId);
  console.log("BTC tx:", deployment.btcTxId);
  console.log("\nNext steps:");
  console.log("1. Set in backend/.env:  FACTORY_ADDRESS=" + deployment.address);
  console.log("2. Set in frontend/.env: NEXT_PUBLIC_LAUNCH_FACTORY_ADDRESS=" + deployment.address);
  console.log("3. Set START_BLOCK to the block number of the deploy tx");
  console.log("4. Run: cd backend && npm run indexer");
  console.log("\nBlockscout:", `https://blockscout.staging.midl.xyz/address/${deployment.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
