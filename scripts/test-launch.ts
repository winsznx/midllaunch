import { ethers } from "hardhat";
import { parseUnits, keccak256, toUtf8Bytes } from "ethers";

/**
 * Test script to create a demo launch and perform a test purchase
 * This demonstrates the complete flow for Phase 2.5 (produce real txid proof)
 */
async function main() {
  console.log("🧪 Creating test launch on Midl Staging...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BTC\n");

  // Get deployed factory address (update this after deployment)
  const factoryAddress = process.env.FACTORY_ADDRESS;
  if (!factoryAddress) {
    throw new Error("FACTORY_ADDRESS not set. Run deploy.ts first.");
  }

  const factory = await ethers.getContractAt("LaunchFactory", factoryAddress);
  console.log("Using LaunchFactory at:", factoryAddress);
  console.log("");

  // Create test launch (per PRD Section 8 parameter bounds)
  const intentId = keccak256(toUtf8Bytes(`test-launch-${Date.now()}`));
  const launchParams = {
    name: "MidlTest Token",
    symbol: "MTEST",
    supplyCap: parseUnits("5000000", 18), // 5M tokens
    basePrice: 50_000n, // 50k sats per token at supply=0
    priceIncrement: 100n, // +100 sats per token
    creatorFeeRate: 100, // 1%
    mode: 0, // MANUAL execution mode
    modeMetadata: ethers.ZeroHash,
  };

  console.log("📝 Launch Parameters:");
  console.log("  Name:", launchParams.name);
  console.log("  Symbol:", launchParams.symbol);
  console.log("  Supply Cap:", ethers.formatUnits(launchParams.supplyCap, 18), "tokens");
  console.log("  Base Price:", launchParams.basePrice.toString(), "sats/token");
  console.log("  Price Increment:", launchParams.priceIncrement.toString(), "sats/token/token");
  console.log("  Creator Fee:", launchParams.creatorFeeRate / 100, "%");
  console.log("");

  console.log("🚀 Creating launch...");
  const createTx = await factory.createLaunch(
    intentId,
    launchParams.name,
    launchParams.symbol,
    launchParams.supplyCap,
    launchParams.basePrice,
    launchParams.priceIncrement,
    launchParams.creatorFeeRate,
    launchParams.mode,
    launchParams.modeMetadata
  );

  console.log("  FBT (Funding BTC Transaction) txid:", createTx.hash);
  console.log("  View on BTC explorer:", `${process.env.MIDL_BTC_EXPLORER}/tx/${createTx.hash}`);
  console.log("");

  console.log("⏳ Waiting for confirmation...");
  const receipt = await createTx.wait();
  console.log("✅ Launch created! Midl execution txid:", receipt?.hash);
  console.log("  View on Blockscout:", `${process.env.MIDL_EXPLORER}/tx/${receipt?.hash}`);
  console.log("");

  // Parse LaunchCreated event
  const event = receipt?.logs.find((log: any) => {
    try {
      return log.fragment?.name === "LaunchCreated";
    } catch {
      return false;
    }
  });

  if (!event) {
    throw new Error("LaunchCreated event not found");
  }

  const eventData: any = event;
  const tokenAddress = eventData.args[0];
  const curveAddress = eventData.args[1];

  console.log("📊 Deployed Contracts:");
  console.log("  Token:", tokenAddress);
  console.log("  Curve:", curveAddress);
  console.log("");

  // Get contract instances
  const token = await ethers.getContractAt("LaunchToken", tokenAddress);
  const curve = await ethers.getContractAt("BondingCurvePrimaryMarket", curveAddress);

  // Display current state
  const currentPrice = await curve.getCurrentPrice();
  const totalSupply = await token.totalSupply();
  const supplyCap = await token.supplyCap();

  console.log("📈 Current State:");
  console.log("  Total Supply:", ethers.formatUnits(totalSupply, 18), "tokens");
  console.log("  Supply Cap:", ethers.formatUnits(supplyCap, 18), "tokens");
  console.log("  Current Price:", currentPrice.toString(), "sats/token");
  console.log("");

  // Perform test purchase
  console.log("💰 Performing test purchase...");
  const buyAmount = 1_000_000n; // 1M sats
  const expectedTokens = await curve.calculatePurchaseReturn(buyAmount, totalSupply);
  const minTokensOut = (expectedTokens * 99n) / 100n; // 1% slippage tolerance

  console.log("  Buying with:", buyAmount.toString(), "sats");
  console.log("  Expected tokens:", ethers.formatUnits(expectedTokens, 18));
  console.log("  Min tokens out:", ethers.formatUnits(minTokensOut, 18));
  console.log("");

  const buyIntentId = keccak256(toUtf8Bytes(`test-buy-${Date.now()}`));
  const buyTx = await curve.buy(buyIntentId, minTokensOut, {
    value: buyAmount,
  });

  console.log("  FBT txid:", buyTx.hash);
  console.log("  View on BTC explorer:", `${process.env.MIDL_BTC_EXPLORER}/tx/${buyTx.hash}`);
  console.log("");

  console.log("⏳ Waiting for buy confirmation...");
  const buyReceipt = await buyTx.wait();
  console.log("✅ Purchase complete! Midl execution txid:", buyReceipt?.hash);
  console.log("  View on Blockscout:", `${process.env.MIDL_EXPLORER}/tx/${buyReceipt?.hash}`);
  console.log("");

  // Display updated state
  const newSupply = await token.totalSupply();
  const newPrice = await curve.getCurrentPrice();
  const buyerBalance = await token.balanceOf(deployer.address);
  const totalBTC = await curve.totalBTCDepositedSats();

  console.log("📊 Updated State:");
  console.log("  Total Supply:", ethers.formatUnits(newSupply, 18), "tokens");
  console.log("  Current Price:", newPrice.toString(), "sats/token");
  console.log("  Your Balance:", ethers.formatUnits(buyerBalance, 18), "tokens");
  console.log("  Total BTC Deposited:", totalBTC.toString(), "sats");
  console.log("");

  // Proof links for submission
  console.log("📋 PROOF LINKS FOR SUBMISSION:");
  console.log("");
  console.log("Create Launch:");
  console.log("  FBT (Bitcoin):", `${process.env.MIDL_BTC_EXPLORER}/tx/${createTx.hash}`);
  console.log("  Execution (Midl):", `${process.env.MIDL_EXPLORER}/tx/${receipt?.hash}`);
  console.log("");
  console.log("Buy Tokens:");
  console.log("  FBT (Bitcoin):", `${process.env.MIDL_BTC_EXPLORER}/tx/${buyTx.hash}`);
  console.log("  Execution (Midl):", `${process.env.MIDL_EXPLORER}/tx/${buyReceipt?.hash}`);
  console.log("");

  return {
    launch: {
      token: tokenAddress,
      curve: curveAddress,
      createTx: createTx.hash,
      executionTx: receipt?.hash,
    },
    purchase: {
      buyTx: buyTx.hash,
      executionTx: buyReceipt?.hash,
      tokensReceived: ethers.formatUnits(buyerBalance, 18),
    },
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
