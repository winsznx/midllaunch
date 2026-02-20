// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MidlNFT.sol";

contract NftFactory {
    address[] public allCollections;
    mapping(address => bool) public isCollection;

    event CollectionCreated(
        bytes32 indexed intentId,
        address indexed creator,
        address indexed collection,
        string name,
        string symbol,
        uint256 maxSupply,
        uint256 mintPrice
    );

    function createCollection(
        bytes32 intentId,
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        uint256 mintPrice,
        uint256 maxPerWallet,
        string memory metadataCID
    ) external returns (address) {
        require(maxSupply >= 1 && maxSupply <= 10000, "Supply: 1-10000");
        require(maxPerWallet >= 1 && maxPerWallet <= 100, "MaxPerWallet: 1-100");

        MidlNFT collection = new MidlNFT(
            name, symbol, maxSupply, mintPrice, maxPerWallet, metadataCID, msg.sender
        );

        allCollections.push(address(collection));
        isCollection[address(collection)] = true;

        emit CollectionCreated(intentId, msg.sender, address(collection), name, symbol, maxSupply, mintPrice);
        return address(collection);
    }

    function getAllCollections() external view returns (address[] memory) {
        return allCollections;
    }
}
