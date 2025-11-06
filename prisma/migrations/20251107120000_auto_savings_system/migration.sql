-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'REJECTED', 'FUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "LedgerAction" AS ENUM ('DEPOSIT_PENDING', 'DEPOSIT_CONFIRMED', 'DEPOSIT_FAILED', 'WITHDRAW_REQUESTED', 'WITHDRAW_CANCELLED', 'WITHDRAW_COMPLETED', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'READY', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "savingPercentBps" INTEGER NOT NULL DEFAULT 0,
    "withdrawalDelaySeconds" INTEGER NOT NULL DEFAULT 86400,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "chainId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastDetectedAt" TIMESTAMP(3),
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingTransaction" (
    "id" SERIAL NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT,
    "tokenAddress" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amountRaw" DECIMAL(78,0) NOT NULL,
    "saveAmountWei" DECIMAL(78,0) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "authorizedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "fundedAt" TIMESTAMP(3),
    "vaultTxHash" TEXT,
    "walletId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "IncomingTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsLedger" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "walletId" INTEGER NOT NULL,
    "transactionId" INTEGER,
    "action" "LedgerAction" NOT NULL,
    "amountWei" DECIMAL(78,0) NOT NULL,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "SavingsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "walletId" INTEGER NOT NULL,
    "amountWei" DECIMAL(78,0) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "requestTxHash" TEXT,
    "executeTxHash" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "IncomingTransaction_walletId_idx" ON "IncomingTransaction"("walletId");

-- CreateIndex
CREATE INDEX "IncomingTransaction_userId_idx" ON "IncomingTransaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IncomingTransaction_txHash_walletId_tokenAddress_key" ON "IncomingTransaction"("txHash", "walletId", "tokenAddress");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsLedger_transactionId_key" ON "SavingsLedger"("transactionId");

-- CreateIndex
CREATE INDEX "SavingsLedger_userId_idx" ON "SavingsLedger"("userId");

-- CreateIndex
CREATE INDEX "SavingsLedger_walletId_idx" ON "SavingsLedger"("walletId");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_walletId_status_idx" ON "WithdrawalRequest"("walletId", "status");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_userId_status_idx" ON "WithdrawalRequest"("userId", "status");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingTransaction" ADD CONSTRAINT "IncomingTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingTransaction" ADD CONSTRAINT "IncomingTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsLedger" ADD CONSTRAINT "SavingsLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsLedger" ADD CONSTRAINT "SavingsLedger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsLedger" ADD CONSTRAINT "SavingsLedger_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "IncomingTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

