-- CreateTable
CREATE TABLE "BlockTracking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lastProcessedBlock" BIGINT NOT NULL,
    "timestamp" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Launch" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "blockNumber" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "launchId" TEXT NOT NULL,
    "buyer" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "btcAmount" TEXT NOT NULL,
    "tokenAmount" TEXT NOT NULL,
    "newSupply" TEXT NOT NULL,
    "newPrice" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "Purchase_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaunchFinalization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "launchId" TEXT NOT NULL,
    "finalSupply" TEXT NOT NULL,
    "totalBTCDeposited" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "LaunchFinalization_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fbtTxId" TEXT,
    "midlTxHash" TEXT,
    "rbtTxId" TEXT,
    "intentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SIGNED',
    "data" TEXT NOT NULL,
    "errorReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "btcConfirmations" INTEGER NOT NULL DEFAULT 0
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
CREATE UNIQUE INDEX "LaunchFinalization_launchId_key" ON "LaunchFinalization"("launchId");

-- CreateIndex
CREATE INDEX "LaunchFinalization_timestamp_idx" ON "LaunchFinalization"("timestamp");

-- CreateIndex
CREATE INDEX "Transaction_userAddress_idx" ON "Transaction"("userAddress");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_fbtTxId_idx" ON "Transaction"("fbtTxId");

-- CreateIndex
CREATE INDEX "Transaction_midlTxHash_idx" ON "Transaction"("midlTxHash");
