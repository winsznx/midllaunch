import hre from "hardhat";
import { getDefaultAccount, getBalance } from "@midl/core";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Deploying MidlLaunch to Midl Staging...\n");

  const protocolFeeRate = parseInt(process.env.PROTOCOL_FEE_RATE || "50");
  const feeRecipient = process.env.FEE_RECIPIENT;
  if (!feeRecipient) {
    throw new Error("FEE_RECIPIENT not set in .env — set it to your EVM deployer address");
  }

  console.log("Protocol fee rate:", protocolFeeRate, "bps");
  console.log("Fee recipient:    ", feeRecipient);

  const midlConfig = await hre.midl.initialize();
  const account = getDefaultAccount(midlConfig);
  const btcAddress = account?.address;

  console.log("Deployer BTC:     ", btcAddress ?? "(unknown)");

  if (btcAddress) {
    const balance = await getBalance(midlConfig, btcAddress);
    const confirmed = typeof balance === "number" ? balance : (balance as any)?.confirmed ?? 0;
    console.log("BTC balance:      ", confirmed, "sats confirmed");
    if (confirmed < 10000) {
      throw new Error(
        `Insufficient BTC. Need at least 10,000 sats.\nFund this address:\n  ${btcAddress}\n  https://faucet.midl.xyz`
      );
    }
  }

  // ─── 1. LaunchFactory ────────────────────────────────────────────────────
  console.log("\n[1/3] Deploying LaunchFactory...");
  await hre.midl.deploy("LaunchFactory", [protocolFeeRate, feeRecipient], { gas: 5_000_000n });
  await hre.midl.execute();
  const launchFactory = await hre.midl.get("LaunchFactory");
  console.log("      ✓ LaunchFactory:", launchFactory.address);

  // ─── 2. NftFactory ───────────────────────────────────────────────────────
  console.log("\n[2/3] Deploying NftFactory...");
  await hre.midl.deploy("NftFactory", [], { gas: 5_000_000n });
  await hre.midl.execute();
  const nftFactory = await hre.midl.get("NftFactory");
  console.log("      ✓ NftFactory:   ", nftFactory.address);

  // ─── 3. NftMarketplace ───────────────────────────────────────────────────
  console.log("\n[3/3] Deploying NftMarketplace...");
  await hre.midl.deploy("NftMarketplace", [], { gas: 3_000_000n });
  await hre.midl.execute();
  const nftMarketplace = await hre.midl.get("NftMarketplace");
  console.log("      ✓ NftMarketplace:", nftMarketplace.address);

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════");
  console.log("DEPLOYMENT COMPLETE");
  console.log("══════════════════════════════════════════════════════");
  console.log("\nContracts:");
  console.log("  LaunchFactory  ", launchFactory.address);
  console.log("  NftFactory     ", nftFactory.address);
  console.log("  NftMarketplace ", nftMarketplace.address);

  console.log("\nExplorer:");
  const base = "https://blockscout.staging.midl.xyz/address";
  console.log(" ", base + "/" + launchFactory.address);
  console.log(" ", base + "/" + nftFactory.address);
  console.log(" ", base + "/" + nftMarketplace.address);

  // ─── Write env snippets ───────────────────────────────────────────────────
  const backendEnv = [
    `FACTORY_ADDRESS=${launchFactory.address}`,
    `NFT_FACTORY_ADDRESS=${nftFactory.address}`,
    `NFT_MARKETPLACE_ADDRESS=${nftMarketplace.address}`,
    `START_BLOCK=0`,
  ].join("\n");

  const frontendEnv = [
    `NEXT_PUBLIC_LAUNCH_FACTORY_ADDRESS=${launchFactory.address}`,
    `NEXT_PUBLIC_NFT_FACTORY_ADDRESS=${nftFactory.address}`,
    `NEXT_PUBLIC_NFT_MARKETPLACE_ADDRESS=${nftMarketplace.address}`,
  ].join("\n");

  const snippetPath = path.join(__dirname, "..", "deployments", "env-update.txt");
  fs.writeFileSync(
    snippetPath,
    `# ── backend/.env ──────────────────────────────────\n${backendEnv}\n\n# ── frontend/.env.local ───────────────────────────\n${frontendEnv}\n`
  );

  console.log("\nEnv snippet written to: deployments/env-update.txt");
  console.log("\n── backend/.env ──");
  console.log(backendEnv);
  console.log("\n── frontend/.env.local ──");
  console.log(frontendEnv);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
