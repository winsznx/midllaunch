// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MidlNFT is ERC721URIStorage, Ownable {
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

    function mint(bytes32 intentId, uint256 quantity) external payable {
        require(totalSupply + quantity <= maxSupply, "Exceeds max supply");
        require(mintedPerWallet[msg.sender] + quantity <= maxPerWallet, "Exceeds max per wallet");
        require(msg.value >= mintPrice * quantity, "Insufficient payment");

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(msg.sender, tokenId);
            _setTokenURI(tokenId, string(abi.encodePacked("ipfs://", collectionMetadataCID, "/", _toString(tokenId), ".json")));
            emit NFTMinted(intentId, msg.sender, tokenId, mintPrice);
        }

        totalSupply += quantity;
        mintedPerWallet[msg.sender] += quantity;

        payable(creator).transfer(msg.value);
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { digits--; buffer[digits] = bytes1(uint8(48 + value % 10)); value /= 10; }
        return string(buffer);
    }
}
