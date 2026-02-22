-- CreateTable
CREATE TABLE "BlockTracking" (
    "id" SERIAL NOT NULL,
    "lastProcessedBlock" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Launch" (
    "id" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "curveAddress" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "supplyCap" TEXT NOT NULL,
    "basePrice" TEXT NOT NULL,
    "priceIncrement" TEXT NOT NULL,
    "creatorFeeRate" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadataUri" TEXT,
    "metadataCID" TEXT,
    "imageUrl" TEXT,
    "description" TEXT,
    "twitterUrl" TEXT,
    "telegramUrl" TEXT,
    "websiteUrl" TEXT,
    "launchType" TEXT NOT NULL DEFAULT 'TOKEN',
    "blockNumber" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "tradeType" TEXT NOT NULL DEFAULT 'BUY',
    "buyer" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "btcAmount" TEXT NOT NULL,
    "tokenAmount" TEXT NOT NULL,
    "newSupply" TEXT NOT NULL,
    "newPrice" TEXT NOT NULL,
    "supplyBefore" TEXT,
    "supplyAfter" TEXT,
    "blockNumber" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NftLaunch" (
    "id" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "totalSupply" INTEGER NOT NULL,
    "mintPrice" BIGINT NOT NULL,
    "maxPerWallet" INTEGER NOT NULL,
    "metadataCID" TEXT,
    "imageUrl" TEXT,
    "description" TEXT,
    "twitterUrl" TEXT,
    "telegramUrl" TEXT,
    "websiteUrl" TEXT,
    "totalMinted" INTEGER NOT NULL DEFAULT 0,
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "creatorAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NftLaunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NftMint" (
    "id" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "buyerAddress" TEXT NOT NULL,
    "pricePaidSats" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "btcTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NftMint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotJob" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "xHandle" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "intentJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "launchAddress" TEXT,
    "tokenSymbol" TEXT,
    "amountSats" BIGINT,
    "walletAddress" TEXT,
    "txHash" TEXT,
    "btcTxHash" TEXT,
    "replyTweetId" TEXT,
    "expiryReplyTweetId" TEXT,
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XWalletLink" (
    "id" TEXT NOT NULL,
    "xHandle" TEXT NOT NULL,
    "btcAddress" TEXT NOT NULL,
    "evmAddress" TEXT,
    "signedMessage" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XWalletLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingMetadata" (
    "id" TEXT NOT NULL,
    "btcTxId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "btcAddress" TEXT,
    "metadataCID" TEXT NOT NULL,
    "imageCID" TEXT,
    "description" TEXT,
    "twitterUrl" TEXT,
    "telegramUrl" TEXT,
    "websiteUrl" TEXT,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Launch_tokenAddress_key" ON "Launch"("tokenAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Launch_curveAddress_key" ON "Launch"("curveAddress");

-- CreateIndex
CREATE INDEX "Launch_creator_idx" ON "Launch"("creator");

-- CreateIndex
CREATE INDEX "Launch_timestamp_idx" ON "Launch"("timestamp");

-- CreateIndex
CREATE INDEX "Launch_status_idx" ON "Launch"("status");

-- CreateIndex
CREATE INDEX "Purchase_launchId_timestamp_idx" ON "Purchase"("launchId", "timestamp");

-- CreateIndex
CREATE INDEX "Purchase_buyer_idx" ON "Purchase"("buyer");

-- CreateIndex
CREATE INDEX "Purchase_txHash_idx" ON "Purchase"("txHash");

-- CreateIndex
CREATE INDEX "Purchase_tradeType_idx" ON "Purchase"("tradeType");

-- CreateIndex
CREATE INDEX "Comment_launchId_timestamp_idx" ON "Comment"("launchId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "NftLaunch_contractAddress_key" ON "NftLaunch"("contractAddress");

-- CreateIndex
CREATE INDEX "NftLaunch_creatorAddress_idx" ON "NftLaunch"("creatorAddress");

-- CreateIndex
CREATE INDEX "NftLaunch_createdAt_idx" ON "NftLaunch"("createdAt");

-- CreateIndex
CREATE INDEX "NftMint_launchId_createdAt_idx" ON "NftMint"("launchId", "createdAt");

-- CreateIndex
CREATE INDEX "NftMint_buyerAddress_idx" ON "NftMint"("buyerAddress");

-- CreateIndex
CREATE UNIQUE INDEX "BotJob_tweetId_key" ON "BotJob"("tweetId");

-- CreateIndex
CREATE UNIQUE INDEX "XWalletLink_xHandle_key" ON "XWalletLink"("xHandle");

-- CreateIndex
CREATE INDEX "PendingMetadata_name_symbol_idx" ON "PendingMetadata"("name", "symbol");

-- CreateIndex
CREATE INDEX "PendingMetadata_btcTxId_idx" ON "PendingMetadata"("btcTxId");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftMint" ADD CONSTRAINT "NftMint_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "NftLaunch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
