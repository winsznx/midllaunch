// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title LaunchToken
 * @notice ERC20 token with immutable supply cap and authorized minter
 * @dev Complies with MidlLaunch PRD v1.3 Section 7 & 7B
 *
 * Key invariants (MUST enforce):
 * - totalSupply() <= supplyCap (always)
 * - Only minter can call mint()
 * - name, symbol, supplyCap, minter are immutable
 * - Uses 18 decimals (standard ERC20)
 */
contract LaunchToken is ERC20 {
    // Immutable parameters (set at deployment, never change)
    uint256 public immutable supplyCap;  // in base units (1e18 per whole token)
    address public immutable factory;    // factory that deployed this token
    address public minter;               // bonding curve address (only authorized minter)
    bool private minterInitialized;      // one-time initialization flag

    /**
     * @notice Deploy new launch token with immutable parameters
     * @param _name Token name (e.g., "MyToken")
     * @param _symbol Token symbol (e.g., "MTK")
     * @param _supplyCap Maximum supply in base units (e.g., 1M tokens = 1e24 base units)
     */
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _supplyCap
    ) ERC20(_name, _symbol) {
        require(_supplyCap > 0, "LaunchToken: supply cap must be > 0");

        supplyCap = _supplyCap;
        factory = msg.sender;  // Factory deploying this token
        minterInitialized = false;
    }

    /**
     * @notice Initialize minter address (one-time only, callable by factory)
     * @dev Used to resolve circular dependency: token needs curve address, curve needs token address
     * @param _minter Address of bonding curve contract
     */
    function initializeMinter(address _minter) external {
        require(msg.sender == factory, "LaunchToken: only factory can initialize");
        require(!minterInitialized, "LaunchToken: minter already initialized");
        require(_minter != address(0), "LaunchToken: minter cannot be zero address");

        minter = _minter;
        minterInitialized = true;
    }

    /**
     * @notice Mint tokens to specified address
     * @dev ONLY callable by authorized minter (bonding curve)
     * @dev Enforces supply cap invariant: totalSupply + amount <= supplyCap
     * @param to Recipient address
     * @param amount Amount to mint in base units
     */
    function mint(address to, uint256 amount) external {
        require(minterInitialized, "LaunchToken: minter not initialized");
        require(msg.sender == minter, "LaunchToken: only minter can mint");
        require(totalSupply() + amount <= supplyCap, "LaunchToken: exceeds supply cap");

        _mint(to, amount);
    }

    /**
     * @notice Returns token decimals (standard ERC20: 18)
     * @dev Per PRD Section 7B.2: TOKEN_UNIT = 1e18 base units per 1 whole token
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
