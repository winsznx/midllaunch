// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LaunchToken.sol";
import "./BondingCurvePrimaryMarket.sol";

/**
 * @title LaunchFactory
 * @notice Factory for deploying token launches with bonding curves
 * @dev Complies with MidlLaunch PRD v1.3 Section 7 & 18
 *
 * Key invariants (MUST enforce):
 * - Parameters must fall within protocol bounds (Section 8)
 * - Once deployed, a launch cannot be re-deployed at same address
 * - Creator address is immutable per launch
 * - Admin can ONLY affect new launches (createLaunch), NOT existing buy() execution
 */
contract LaunchFactory {
    // Execution modes (per PRD v1.3 Section 18)
    enum ExecutionMode {
        MANUAL,
        AI_ASSISTED,
        AGENT_DRIVEN
    }

    // Launch metadata structure
    struct LaunchMetadata {
        address tokenAddress;
        address curveAddress;
        address creator;
        uint256 timestamp;
        ExecutionMode mode;
    }

    // Registry of all launches
    mapping(address => LaunchMetadata) public launches;
    address[] public allLaunches;

    // Protocol parameters (admin-controlled, affect NEW launches only)
    uint256 public protocolFeeRate;  // Basis points (e.g., 50 = 0.5%)
    address public feeRecipient;
    address public admin;
    bool public paused;  // Emergency pause for NEW launch creation only

    // Parameter bounds (per PRD Section 8 - IMMUTABLE protocol rules)
    uint256 public constant MIN_BASE_PRICE = 1_000;           // 1,000 sats
    uint256 public constant MAX_BASE_PRICE = 1_000_000;       // 1M sats
    uint256 public constant MIN_PRICE_INCREMENT = 1;          // 1 sat
    uint256 public constant MAX_PRICE_INCREMENT = 10_000;     // 10k sats
    uint256 public constant MIN_SUPPLY_CAP = 1_000_000 * 1e18;   // 1M tokens (base units)
    uint256 public constant MAX_SUPPLY_CAP = 21_000_000 * 1e18;  // 21M tokens (base units)
    uint256 public constant MAX_CREATOR_FEE_RATE = 1000;      // Max 10% creator fee

    // Events (per PRD Section 13 + v1.3 Appendix B.4)
    event LaunchCreated(
        address indexed tokenAddress,
        address indexed curveAddress,
        address indexed creator,
        bytes32 intentId,
        uint256 supplyCap,
        uint256 basePrice,
        uint256 priceIncrement,
        ExecutionMode mode,
        bytes32 modeMetadata
    );

    event ProtocolFeeRateUpdated(uint256 oldRate, uint256 newRate);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    event PauseStatusUpdated(bool paused);

    modifier onlyAdmin() {
        require(msg.sender == admin, "LaunchFactory: only admin");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "LaunchFactory: paused");
        _;
    }

    constructor(uint256 _protocolFeeRate, address _feeRecipient) {
        require(_feeRecipient != address(0), "LaunchFactory: fee recipient cannot be zero");
        require(_protocolFeeRate <= 200, "LaunchFactory: protocol fee too high"); // Max 2%

        admin = msg.sender;
        protocolFeeRate = _protocolFeeRate;
        feeRecipient = _feeRecipient;
        paused = false;
    }

    /**
     * @notice Create new token launch with bonding curve
     * @dev Enforces protocol parameter bounds (Section 8)
     * @param intentId Intent identifier for correlation with FBT txid (Section 9.8)
     * @param name Token name
     * @param symbol Token symbol
     * @param supplyCap Maximum supply in base units (must be within bounds)
     * @param basePrice Initial price in sats per whole token (must be within bounds)
     * @param priceIncrement Price increase per whole token (must be within bounds)
     * @param creatorFeeRate Creator fee in basis points (must be <= MAX_CREATOR_FEE_RATE)
     * @param mode Execution mode (Manual, AI-Assisted, or Agent-Driven)
     * @param modeMetadata Hash of AI model ID or agentId (per v1.3 Appendix B.4)
     * @return tokenAddress Address of deployed token
     * @return curveAddress Address of deployed bonding curve
     */
    function createLaunch(
        bytes32 intentId,
        string memory name,
        string memory symbol,
        uint256 supplyCap,
        uint256 basePrice,
        uint256 priceIncrement,
        uint256 creatorFeeRate,
        ExecutionMode mode,
        bytes32 modeMetadata
    ) external whenNotPaused returns (address tokenAddress, address curveAddress) {
        // Validate parameter bounds (Section 8)
        require(basePrice >= MIN_BASE_PRICE && basePrice <= MAX_BASE_PRICE,
            "LaunchFactory: basePrice out of bounds");
        require(priceIncrement >= MIN_PRICE_INCREMENT && priceIncrement <= MAX_PRICE_INCREMENT,
            "LaunchFactory: priceIncrement out of bounds");
        require(supplyCap >= MIN_SUPPLY_CAP && supplyCap <= MAX_SUPPLY_CAP,
            "LaunchFactory: supplyCap out of bounds");
        require(creatorFeeRate <= MAX_CREATOR_FEE_RATE,
            "LaunchFactory: creatorFeeRate too high");
        require(bytes(name).length > 0 && bytes(symbol).length > 0,
            "LaunchFactory: name and symbol required");

        // Deploy token contract first (factory is deployer, minter initialized later)
        LaunchToken tokenContract = new LaunchToken(
            name,
            symbol,
            supplyCap
        );
        tokenAddress = address(tokenContract);

        // Deploy bonding curve contract with token address
        BondingCurvePrimaryMarket curve = new BondingCurvePrimaryMarket(
            tokenAddress,
            basePrice,
            priceIncrement,
            creatorFeeRate,
            msg.sender,  // Creator
            address(this)  // Factory
        );
        curveAddress = address(curve);

        // Initialize token's minter to curve (one-time only)
        tokenContract.initializeMinter(curveAddress);

        // Register launch in canonical registry
        launches[tokenAddress] = LaunchMetadata({
            tokenAddress: tokenAddress,
            curveAddress: curveAddress,
            creator: msg.sender,
            timestamp: block.timestamp,
            mode: mode
        });
        allLaunches.push(tokenAddress);

        // Emit canonical event (per Section 13)
        emit LaunchCreated(
            tokenAddress,
            curveAddress,
            msg.sender,
            intentId,
            supplyCap,
            basePrice,
            priceIncrement,
            mode,
            modeMetadata
        );
    }

    /**
     * @notice Get total number of launches
     */
    function launchCount() external view returns (uint256) {
        return allLaunches.length;
    }

    /**
     * @notice Get launch metadata by token address
     */
    function getLaunch(address tokenAddress) external view returns (LaunchMetadata memory) {
        require(launches[tokenAddress].tokenAddress != address(0), "LaunchFactory: launch not found");
        return launches[tokenAddress];
    }

    // Admin functions (per PRD Section 14: affect factory only, NOT existing launches)

    /**
     * @notice Update protocol fee rate (affects NEW launches only)
     * @dev Per Section 14: Admin can only affect createLaunch(), never buy() on existing curves
     */
    function setProtocolFeeRate(uint256 newRate) external onlyAdmin {
        require(newRate <= 200, "LaunchFactory: fee rate too high"); // Max 2%
        uint256 oldRate = protocolFeeRate;
        protocolFeeRate = newRate;
        emit ProtocolFeeRateUpdated(oldRate, newRate);
    }

    /**
     * @notice Update fee recipient address
     */
    function setFeeRecipient(address newRecipient) external onlyAdmin {
        require(newRecipient != address(0), "LaunchFactory: cannot be zero address");
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    /**
     * @notice Emergency pause NEW launch creation (does NOT halt buy() on existing curves)
     * @dev Per Section 14: Admin can only pause createLaunch(), NOT buy() execution
     */
    function setPaused(bool _paused) external onlyAdmin {
        paused = _paused;
        emit PauseStatusUpdated(_paused);
    }

    /**
     * @notice Transfer admin role
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "LaunchFactory: cannot be zero address");
        admin = newAdmin;
    }
}
