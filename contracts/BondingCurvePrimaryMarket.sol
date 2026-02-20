// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LaunchToken.sol";

/**
 * @title BondingCurvePrimaryMarket
 * @notice Linear bonding curve for primary token issuance (buy-side ONLY)
 * @dev Complies with MidlLaunch PRD v1.3 Section 8 & Appendix A
 *
 * Key invariants (MUST enforce):
 * - Price monotonically increases with supply (Section 8)
 * - Buy reverts if tokens < minTokensOut (slippage protection)
 * - Buy reverts if minting would exceed supply cap
 * - Curve parameters are immutable
 * - Only buy() is supported (NO sell in v1)
 * - totalBTCDepositedSats tracks cumulative credited sats (Section 7B.5)
 */
contract BondingCurvePrimaryMarket is ReentrancyGuard {
    // Immutable curve parameters (per PRD Section 8)
    LaunchToken public immutable token;
    uint256 public immutable basePrice_sats_per_token;            // Sats for 1 whole token at supply=0
    uint256 public immutable priceIncrement_sats_per_token_per_token;  // Sats added per whole token minted
    uint256 public immutable creatorFeeRate;                      // Basis points (e.g., 100 = 1%)
    address public immutable creator;
    address public immutable factory;

    // Reserve accounting (per PRD Section 7B.5)
    // NOTE: This is credited vBTC accounting, NOT cryptographic proof of BTC in TSS vaults
    uint256 public totalBTCDepositedSats;

    // Constants
    uint256 private constant TOKEN_UNIT = 1e18;  // 1 whole token = 1e18 base units (Section 7B.2)

    // Events (per PRD Section 13)
    event TokensPurchased(
        address indexed buyer,
        bytes32 indexed intentId,
        uint256 btcAmountSats,
        uint256 tokenAmountBaseUnits,
        uint256 newTotalSupply,
        uint256 newPrice
    );

    /**
     * @notice Deploy bonding curve for a launch token
     * @param _token LaunchToken contract address
     * @param _basePrice Sats required to mint 1 whole token at supply=0
     * @param _priceIncrement Sats added to price per whole token of supply
     * @param _creatorFeeRate Creator fee in basis points (100 = 1%)
     * @param _creator Address to receive creator fees
     * @param _factory Factory contract address (for protocol fee lookups)
     */
    constructor(
        address _token,
        uint256 _basePrice,
        uint256 _priceIncrement,
        uint256 _creatorFeeRate,
        address _creator,
        address _factory
    ) {
        require(_token != address(0), "BondingCurve: token cannot be zero address");
        require(_basePrice > 0, "BondingCurve: basePrice must be > 0");
        require(_priceIncrement > 0, "BondingCurve: priceIncrement must be > 0");
        require(_creator != address(0), "BondingCurve: creator cannot be zero address");
        require(_factory != address(0), "BondingCurve: factory cannot be zero address");

        token = LaunchToken(_token);
        basePrice_sats_per_token = _basePrice;
        priceIncrement_sats_per_token_per_token = _priceIncrement;
        creatorFeeRate = _creatorFeeRate;
        creator = _creator;
        factory = _factory;
    }

    /**
     * @notice Buy tokens on bonding curve
     * @dev Per PRD Section 9.3: msg.value represents vBTC credited during Midl execution
     * @dev Actual BTC custody is in validator TSS vaults (trust-minimized, not trustless)
     * @param intentId Intent identifier for correlation with FBT txid (Section 9.8)
     * @param minTokensOut Minimum tokens to receive (slippage protection, in base units)
     */
    function buy(bytes32 intentId, uint256 minTokensOut) external payable nonReentrant {
        uint256 btcAmountSats = msg.value;
        require(btcAmountSats > 0, "BondingCurve: must send BTC");

        // Get current supply in base units
        uint256 currentSupplyBaseUnits = token.totalSupply();

        // Calculate tokens to mint using closed-form formula (Appendix A)
        uint256 tokensToMintBaseUnits = calculatePurchaseReturn(btcAmountSats, currentSupplyBaseUnits);

        // Slippage protection
        require(tokensToMintBaseUnits >= minTokensOut, "BondingCurve: slippage exceeded");

        // Mint tokens to buyer
        token.mint(msg.sender, tokensToMintBaseUnits);

        // Update reserve accounting (credited vBTC, per Section 7B.5)
        totalBTCDepositedSats += btcAmountSats;

        // Emit event with intentId correlation (per Section 9.8)
        emit TokensPurchased(
            msg.sender,
            intentId,
            btcAmountSats,
            tokensToMintBaseUnits,
            token.totalSupply(),
            getCurrentPrice()
        );

        // NOTE: Fee handling per Section 9.6 - V1 defers fee settlement
        // Protocol/creator fees are accounted but not settled via RBTs in this version
    }

    /**
     * @notice Calculate tokens received for given BTC amount
     * @dev Implements closed-form linear curve solution per PRD Appendix A
     * @dev Formula: Solve integral ∫[s to s+Δt] (basePrice + k*σ) dσ = btcIn
     * @dev Result: Δt = (sqrt(b² + 2k*btcIn) - b) / k
     * @param btcInSats BTC amount in satoshis
     * @param currentSupplyBaseUnits Current token supply in base units
     * @return tokensOutBaseUnits Tokens to mint in base units
     */
    function calculatePurchaseReturn(
        uint256 btcInSats,
        uint256 currentSupplyBaseUnits
    ) public view returns (uint256 tokensOutBaseUnits) {
        // Convert supply to whole tokens for pricing (per Section 7B.4)
        uint256 s = currentSupplyBaseUnits / TOKEN_UNIT;  // Integer division (floor)

        // Calculate b = basePrice + k*s (current price in sats per whole token)
        uint256 b = basePrice_sats_per_token + (priceIncrement_sats_per_token_per_token * s);

        // Calculate discriminant: b² + 2k*B
        // Note: discriminant >= b² always, so sqrt(discriminant) >= b (no underflow)
        uint256 discriminant = (b * b) + (2 * priceIncrement_sats_per_token_per_token * btcInSats);

        // Calculate sqrt(discriminant) using Babylonian method
        uint256 sqrtDiscriminant = sqrt(discriminant);

        // Calculate Δt in whole tokens: (sqrt - b) / k
        uint256 deltaT_wholeTokens = (sqrtDiscriminant - b) / priceIncrement_sats_per_token_per_token;

        // Convert back to base units
        tokensOutBaseUnits = deltaT_wholeTokens * TOKEN_UNIT;
    }

    /**
     * @notice Get current price per whole token (at current supply)
     * @dev Price(s) = basePrice + s * priceIncrement (per Section 8)
     * @return Current price in sats per whole token
     */
    function getCurrentPrice() public view returns (uint256) {
        uint256 supplyWholeTokens = token.totalSupply() / TOKEN_UNIT;
        return basePrice_sats_per_token + (supplyWholeTokens * priceIncrement_sats_per_token_per_token);
    }

    /**
     * @notice Integer square root using Babylonian method (Newton's method)
     * @dev Per Appendix A: Required for closed-form curve calculation
     * @param x Input value
     * @return y Square root of x (rounded down)
     */
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;

        // Initial guess: (x + 1) / 2
        uint256 z = (x + 1) / 2;
        y = x;

        // Newton's method: iterate until convergence
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
