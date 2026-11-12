-- AlterTable
ALTER TABLE "discussion" ADD COLUMN     "clientNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "clientReadAt" TIMESTAMP(3),
ADD COLUMN     "portalClientId" TEXT;

-- AlterTable
ALTER TABLE "discussion_message" ADD COLUMN     "fromClient" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "client_account" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "client_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_session" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_password_reset" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_password_reset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_account_clientId_key" ON "client_account"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_account_login_key" ON "client_account"("login");

-- CreateIndex
CREATE UNIQUE INDEX "client_session_tokenHash_key" ON "client_session"("tokenHash");

-- CreateIndex
CREATE INDEX "client_session_accountId_idx" ON "client_session"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "client_password_reset_tokenHash_key" ON "client_password_reset"("tokenHash");

-- CreateIndex
CREATE INDEX "client_password_reset_accountId_idx" ON "client_password_reset"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "discussion_portalClientId_key" ON "discussion"("portalClientId");

-- AddForeignKey
ALTER TABLE "client_account" ADD CONSTRAINT "client_account_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_account" ADD CONSTRAINT "client_account_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_session" ADD CONSTRAINT "client_session_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "client_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_password_reset" ADD CONSTRAINT "client_password_reset_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "client_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

