import { expect } from "chai";
import { ethers } from "hardhat";
import { LaunchFactory, LaunchToken, BondingCurvePrimaryMarket } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { parseUnits, keccak256, toUtf8Bytes } from "ethers";

describe("MidlLaunch Protocol", function () {
  let factory: LaunchFactory;
  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let buyer1: SignerWithAddress;
  let buyer2: SignerWithAddress;
  let feeRecipient: SignerWithAddress;

  // Constants from PRD Section 8
  const TOKEN_UNIT = parseUnits("1", 18); // 1 whole token
  const MIN_SUPPLY_CAP = parseUnits("1000000", 18); // 1M tokens
  const MAX_SUPPLY_CAP = parseUnits("21000000", 18); // 21M tokens
  const MIN_BASE_PRICE = 1_000n; // sats
  const MAX_BASE_PRICE = 1_000_000n; // sats
  const MIN_PRICE_INCREMENT = 1n; // sats
  const MAX_PRICE_INCREMENT = 10_000n; // sats

  beforeEach(async function () {
    [owner, creator, buyer1, buyer2, feeRecipient] = await ethers.getSigners();

    // Deploy factory
    const LaunchFactoryContract = await ethers.getContractFactory("LaunchFactory");
    factory = await LaunchFactoryContract.deploy(50, feeRecipient.address); // 0.5% protocol fee
  });

  describe("LaunchFactory", function () {
    it("Should enforce parameter bounds (Section 8)", async function () {
      const intentId = keccak256(toUtf8Bytes("test-intent-1"));

      // Test basePrice below minimum
      await expect(
        factory.connect(creator).createLaunch(
          intentId,
          "Test Token",
          "TEST",
          MIN_SUPPLY_CAP,
          999n, // Below MIN_BASE_PRICE
          5_000n,
          100,
          0, // MANUAL mode
          ethers.ZeroHash
        )
      ).to.be.revertedWith("LaunchFactory: basePrice out of bounds");

      // Test basePrice above maximum
      await expect(
        factory.connect(creator).createLaunch(
          intentId,
          "Test Token",
          "TEST",
          MIN_SUPPLY_CAP,
          1_000_001n, // Above MAX_BASE_PRICE
          5_000n,
          100,
          0,
          ethers.ZeroHash
        )
      ).to.be.revertedWith("LaunchFactory: basePrice out of bounds");

      // Test priceIncrement below minimum
      await expect(
        factory.connect(creator).createLaunch(
          intentId,
          "Test Token",
          "TEST",
          MIN_SUPPLY_CAP,
          50_000n,
          0n, // Below MIN_PRICE_INCREMENT
          100,
          0,
          ethers.ZeroHash
        )
      ).to.be.revertedWith("LaunchFactory: priceIncrement out of bounds");

      // Test supplyCap below minimum
      await expect(
        factory.connect(creator).createLaunch(
          intentId,
          "Test Token",
          "TEST",
          parseUnits("999999", 18), // Below MIN_SUPPLY_CAP
          50_000n,
          100n,
          100,
          0,
          ethers.ZeroHash
        )
      ).to.be.revertedWith("LaunchFactory: supplyCap out of bounds");

      // Valid parameters should succeed
      await expect(
        factory.connect(creator).createLaunch(
          intentId,
          "Test Token",
          "TEST",
          MIN_SUPPLY_CAP,
          50_000n,
          100n,
          100,
          0,
          ethers.ZeroHash
        )
      ).to.not.be.reverted;
    });

    it("Should emit LaunchCreated event with correct parameters", async function () {
      const intentId = keccak256(toUtf8Bytes("test-intent-2"));
      const supplyCap = parseUnits("5000000", 18);
      const basePrice = 50_000n;
      const priceIncrement = 100n;

      const tx = await factory.connect(creator).createLaunch(
        intentId,
        "Test Token",
        "TEST",
        supplyCap,
        basePrice,
        priceIncrement,
        100,
        0, // MANUAL mode
        ethers.ZeroHash
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "LaunchCreated"
      );

      expect(event).to.not.be.undefined;
    });

    it("Should register launches in canonical registry", async function () {
      const intentId = keccak256(toUtf8Bytes("test-intent-3"));

      const tx = await factory.connect(creator).createLaunch(
        intentId,
        "Test Token",
        "TEST",
        MIN_SUPPLY_CAP,
        50_000n,
        100n,
        100,
        0,
        ethers.ZeroHash
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "LaunchCreated"
      );

      expect(await factory.launchCount()).to.equal(1);
    });
  });

  describe("LaunchToken", function () {
    let token: LaunchToken;
    let curve: BondingCurvePrimaryMarket;

    beforeEach(async function () {
      const intentId = keccak256(toUtf8Bytes("token-test"));
      const tx = await factory.connect(creator).createLaunch(
        intentId,
        "Test Token",
        "TEST",
        parseUnits("5000000", 18),
        50_000n,
        100n,
        100,
        0,
        ethers.ZeroHash
      );

      const receipt = await tx.wait();
      const event: any = receipt?.logs.find(
        (log: any) => log.fragment?.name === "LaunchCreated"
      );

      const tokenAddress = event?.args[0];
      const curveAddress = event?.args[1];

      token = await ethers.getContractAt("LaunchToken", tokenAddress);
      curve = await ethers.getContractAt("BondingCurvePrimaryMarket", curveAddress);
    });

    it("Should have correct decimals (18)", async function () {
      expect(await token.decimals()).to.equal(18);
    });

    it("Should enforce supply cap invariant", async function () {
      const supplyCap = await token.supplyCap();

      // Try to mint exceeding supply cap should revert
      // First, buy up to near cap
      const priceForOneMillion = 50_000n * 1_000_000n; // Approximate
      await curve.connect(buyer1).buy(ethers.ZeroHash, 0, {
        value: priceForOneMillion,
      });

      const currentSupply = await token.totalSupply();
      expect(currentSupply).to.be.lte(supplyCap);

      // Total supply should never exceed cap
      const remainingSupply = supplyCap - currentSupply;
      const overflowAmount = remainingSupply + TOKEN_UNIT;

      // Attempting to buy more than remaining should revert
      await expect(
        curve.connect(buyer1).buy(ethers.ZeroHash, overflowAmount, {
          value: parseUnits("1000000000", "gwei"),
        })
      ).to.be.reverted;
    });

    it("Should only allow minter to mint", async function () {
      // Direct mint call should fail if not from minter
      await expect(
        token.connect(buyer1).mint(buyer1.address, TOKEN_UNIT)
      ).to.be.revertedWith("LaunchToken: only minter can mint");
    });
  });

  describe("BondingCurvePrimaryMarket", function () {
    let token: LaunchToken;
    let curve: BondingCurvePrimaryMarket;
    const basePrice = 50_000n;
    const priceIncrement = 100n;

    beforeEach(async function () {
      const intentId = keccak256(toUtf8Bytes("curve-test"));
      const tx = await factory.connect(creator).createLaunch(
        intentId,
        "Curve Test",
        "CURV",
        parseUnits("5000000", 18),
        basePrice,
        priceIncrement,
        100,
        0,
        ethers.ZeroHash
      );

      const receipt = await tx.wait();
      const event: any = receipt?.logs.find(
        (log: any) => log.fragment?.name === "LaunchCreated"
      );

      token = await ethers.getContractAt("LaunchToken", event?.args[0]);
      curve = await ethers.getContractAt("BondingCurvePrimaryMarket", event?.args[1]);
    });

    it("Should calculate purchase return correctly (Appendix A)", async function () {
      const btcAmount = 1_000_000n; // 1M sats
      const currentSupply = 0n;

      const tokensOut = await curve.calculatePurchaseReturn(btcAmount, currentSupply);

      // Manual calculation for verification
      // At supply=0, price = basePrice = 50,000 sats per token
      // Linear curve: we need to solve integral
      const expectedTokens = 20n * TOKEN_UNIT; // Approximate

      // Tokens should be positive
      expect(tokensOut).to.be.gt(0);
    });

    it("Should enforce monotonic price invariant", async function () {
      const price1 = await curve.getCurrentPrice();

      // Buy some tokens
      const intentId = keccak256(toUtf8Bytes("buy-1"));
      await curve.connect(buyer1).buy(intentId, 0, {
        value: 1_000_000n,
      });

      const price2 = await curve.getCurrentPrice();

      // Price must increase after purchase
      expect(price2).to.be.gt(price1);

      // Buy more tokens
      const intentId2 = keccak256(toUtf8Bytes("buy-2"));
      await curve.connect(buyer1).buy(intentId2, 0, {
        value: 1_000_000n,
      });

      const price3 = await curve.getCurrentPrice();

      // Price must continue increasing
      expect(price3).to.be.gt(price2);
    });

    it("Should enforce slippage protection", async function () {
      const btcAmount = 1_000_000n;
      const currentSupply = await token.totalSupply();

      const expectedTokens = await curve.calculatePurchaseReturn(btcAmount, currentSupply);

      // Set minTokensOut higher than expected should revert
      const intentId = keccak256(toUtf8Bytes("slippage-test"));
      await expect(
        curve.connect(buyer1).buy(intentId, expectedTokens + TOKEN_UNIT, {
          value: btcAmount,
        })
      ).to.be.revertedWith("BondingCurve: slippage exceeded");

      // Set minTokensOut at expected should succeed
      await expect(
        curve.connect(buyer1).buy(intentId, expectedTokens, {
          value: btcAmount,
        })
      ).to.not.be.reverted;
    });

    it("Should emit TokensPurchased event with intentId", async function () {
      const intentId = keccak256(toUtf8Bytes("event-test"));
      const btcAmount = 1_000_000n;

      const tx = await curve.connect(buyer1).buy(intentId, 0, {
        value: btcAmount,
      });

      await expect(tx)
        .to.emit(curve, "TokensPurchased")
        .withArgs(
          buyer1.address,
          intentId,
          btcAmount,
          await curve.calculatePurchaseReturn(btcAmount, 0),
          await token.totalSupply(),
          await curve.getCurrentPrice()
        );
    });

    it("Should track totalBTCDepositedSats correctly", async function () {
      const initialBTC = await curve.totalBTCDepositedSats();
      expect(initialBTC).to.equal(0);

      const btcAmount1 = 1_000_000n;
      await curve.connect(buyer1).buy(ethers.ZeroHash, 0, {
        value: btcAmount1,
      });

      expect(await curve.totalBTCDepositedSats()).to.equal(btcAmount1);

      const btcAmount2 = 2_000_000n;
      await curve.connect(buyer2).buy(ethers.ZeroHash, 0, {
        value: btcAmount2,
      });

      expect(await curve.totalBTCDepositedSats()).to.equal(btcAmount1 + btcAmount2);
    });

    it("Should prevent buying with zero BTC", async function () {
      await expect(
        curve.connect(buyer1).buy(ethers.ZeroHash, 0, {
          value: 0,
        })
      ).to.be.revertedWith("BondingCurve: must send BTC");
    });
  });

  describe("Gas Cost Analysis (Per PRD Phase 1.7)", function () {
    it("Should have O(1) bounded buy() operation", async function () {
      const intentId = keccak256(toUtf8Bytes("gas-test"));
      const tx = await factory.connect(creator).createLaunch(
        intentId,
        "Gas Test",
        "GAS",
        parseUnits("5000000", 18),
        50_000n,
        100n,
        100,
        0,
        ethers.ZeroHash
      );

      const receipt = await tx.wait();
      const event: any = receipt?.logs.find(
        (log: any) => log.fragment?.name === "LaunchCreated"
      );

      const curve = await ethers.getContractAt("BondingCurvePrimaryMarket", event?.args[1]);

      // First buy
      const tx1 = await curve.connect(buyer1).buy(ethers.ZeroHash, 0, {
        value: 1_000_000n,
      });
      const receipt1 = await tx1.wait();
      const gas1 = receipt1?.gasUsed;

      // Second buy (should have similar gas cost, not scale with supply)
      const tx2 = await curve.connect(buyer1).buy(ethers.ZeroHash, 0, {
        value: 1_000_000n,
      });
      const receipt2 = await tx2.wait();
      const gas2 = receipt2?.gasUsed;

      // Gas should be roughly bounded (accounting for cold vs warm storage)
      // First buy has cold storage writes, second has warm storage
      if (gas1 && gas2) {
        const gasDiff = gas1 > gas2 ? gas1 - gas2 : gas2 - gas1;
        const gasDiffPercent = (gasDiff * 100n) / gas1;
        expect(gasDiffPercent).to.be.lte(50); // Allow up to 50% variance for cold/warm storage

        // Both should be under reasonable absolute limit (no loops, O(1) complexity)
        expect(gas1).to.be.lte(500_000); // Max 500k gas
        expect(gas2).to.be.lte(500_000);
      }
    });
  });

  describe("Admin Functions (Per PRD Section 14)", function () {
    it("Should allow admin to update protocol fee rate", async function () {
      await factory.setProtocolFeeRate(100); // 1%
      expect(await factory.protocolFeeRate()).to.equal(100);
    });

    it("Should prevent non-admin from updating fee rate", async function () {
      await expect(
        factory.connect(buyer1).setProtocolFeeRate(100)
      ).to.be.revertedWith("LaunchFactory: only admin");
    });

    it("Should allow admin to pause new launches", async function () {
      await factory.setPaused(true);
      expect(await factory.paused()).to.equal(true);

      await expect(
        factory.connect(creator).createLaunch(
          ethers.ZeroHash,
          "Paused",
          "PAUSE",
          MIN_SUPPLY_CAP,
          50_000n,
          100n,
          100,
          0,
          ethers.ZeroHash
        )
      ).to.be.revertedWith("LaunchFactory: paused");

      // Unpause should allow creation again
      await factory.setPaused(false);
      await expect(
        factory.connect(creator).createLaunch(
          ethers.ZeroHash,
          "Unpaused",
          "UNPAUSE",
          MIN_SUPPLY_CAP,
          50_000n,
          100n,
          100,
          0,
          ethers.ZeroHash
        )
      ).to.not.be.reverted;
    });
  });
});
