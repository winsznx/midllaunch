// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract MidlNFT is ERC721URIStorage, Ownable, ReentrancyGuard {
    using Strings for uint256;

    uint256 public totalSupply;
    uint256 public maxSupply;
    uint256 public mintPrice; // in wei (mapped from sats via Midl)
    uint256 public maxPerWallet;
    address public creator;
    string public collectionMetadataCID;
    mapping(address => uint256) public mintedPerWallet;
    uint256 private _nextTokenId;

    event NFTMinted(bytes32 indexed intentId, address indexed buyer, uint256 tokenId, uint256 pricePaid);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        uint256 mintPrice_,
        uint256 maxPerWallet_,
        string memory metadataCID_,
        address creator_
    ) ERC721(name_, symbol_) Ownable(creator_) {
        maxSupply = maxSupply_;
        mintPrice = mintPrice_;
        maxPerWallet = maxPerWallet_;
        collectionMetadataCID = metadataCID_;
        creator = creator_;
    }

    function mint(bytes32 intentId, uint256 quantity) external payable nonReentrant {
        uint256 totalCost = mintPrice * quantity;
        require(totalSupply + quantity <= maxSupply, "Exceeds max supply");
        require(mintedPerWallet[msg.sender] + quantity <= maxPerWallet, "Exceeds max per wallet");
        require(msg.value >= totalCost, "Insufficient payment");

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(msg.sender, tokenId);
            _setTokenURI(
                tokenId,
                string(abi.encodePacked("ipfs://", collectionMetadataCID, "/", tokenId.toString(), ".json"))
            );
            emit NFTMinted(intentId, msg.sender, tokenId, mintPrice);
        }

        totalSupply += quantity;
        mintedPerWallet[msg.sender] += quantity;

        // Refund overpayment to sender
        if (msg.value > totalCost) {
            (bool refundOk, ) = payable(msg.sender).call{value: msg.value - totalCost}("");
            require(refundOk, "MidlNFT: refund failed");
        }

        // Forward exact cost to creator
        (bool ok, ) = payable(creator).call{value: totalCost}("");
        require(ok, "MidlNFT: creator payment failed");
    }
}
