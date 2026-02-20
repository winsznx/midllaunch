// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title NftMarketplace
 * @notice Secondary peer-to-peer marketplace for MidlNFT collections
 *
 * Flow:
 *   1. Seller: nft.setApprovalForAll(marketplace, true)  [pure EVM — no BTC]
 *   2. Seller: marketplace.list(intentId, collection, tokenId, priceSats)
 *   3. Buyer:  marketplace.buy(intentId, collection, tokenId) { value: priceSats }
 *
 * Invariants:
 *   - Only the lister can delist
 *   - Price is immutable after listing; relist to change
 *   - Reentrancy-guarded on buy
 */
contract NftMarketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 priceSats; // in wei (vBTC, mapped from sats by Midl)
        bool active;
    }

    // collection → tokenId → Listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    event NFTListed(
        bytes32 indexed intentId,
        address indexed collection,
        uint256 indexed tokenId,
        address seller,
        uint256 priceSats
    );

    event NFTSold(
        bytes32 indexed intentId,
        address indexed collection,
        uint256 indexed tokenId,
        address seller,
        address buyer,
        uint256 priceSats
    );

    event NFTDelisted(
        address indexed collection,
        uint256 indexed tokenId,
        address seller
    );

    /**
     * @notice List an NFT for sale
     * @dev Caller must have approved this contract to transfer the token first
     * @param intentId Midl intent correlation ID
     * @param collection ERC-721 collection address
     * @param tokenId Token to list
     * @param priceSats Asking price in satoshis (wei in Midl's vBTC)
     */
    function list(
        bytes32 intentId,
        address collection,
        uint256 tokenId,
        uint256 priceSats
    ) external {
        IERC721 nft = IERC721(collection);
        require(nft.ownerOf(tokenId) == msg.sender, "Marketplace: not owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) ||
            nft.getApproved(tokenId) == address(this),
            "Marketplace: not approved"
        );
        require(priceSats > 0, "Marketplace: price must be > 0");

        listings[collection][tokenId] = Listing({
            seller: msg.sender,
            priceSats: priceSats,
            active: true
        });

        emit NFTListed(intentId, collection, tokenId, msg.sender, priceSats);
    }

    /**
     * @notice Buy a listed NFT
     * @dev msg.value must equal listing.priceSats (no partial fills)
     * @param intentId Midl intent correlation ID
     * @param collection ERC-721 collection address
     * @param tokenId Token to purchase
     */
    function buy(
        bytes32 intentId,
        address collection,
        uint256 tokenId
    ) external payable nonReentrant {
        Listing storage listing = listings[collection][tokenId];
        require(listing.active, "Marketplace: not listed");
        require(msg.value == listing.priceSats, "Marketplace: incorrect payment");
        require(msg.sender != listing.seller, "Marketplace: cannot buy own listing");

        address seller = listing.seller;
        uint256 price = listing.priceSats;
        listing.active = false;

        // Transfer NFT to buyer
        IERC721(collection).safeTransferFrom(seller, msg.sender, tokenId);

        // Forward exact listing price to seller
        (bool ok, ) = payable(seller).call{value: price}("");
        require(ok, "Marketplace: payment failed");

        emit NFTSold(intentId, collection, tokenId, seller, msg.sender, price);
    }

    /**
     * @notice Cancel an active listing
     * @param collection ERC-721 collection address
     * @param tokenId Token to delist
     */
    function delist(address collection, uint256 tokenId) external {
        Listing storage listing = listings[collection][tokenId];
        require(listing.active, "Marketplace: not listed");
        require(listing.seller == msg.sender, "Marketplace: not your listing");

        listing.active = false;
        emit NFTDelisted(collection, tokenId, msg.sender);
    }

    /**
     * @notice Read a single listing
     */
    function getListing(address collection, uint256 tokenId) external view returns (Listing memory) {
        return listings[collection][tokenId];
    }
}
