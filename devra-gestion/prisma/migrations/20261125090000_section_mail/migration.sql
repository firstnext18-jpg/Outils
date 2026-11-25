-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('OUTGOING', 'INCOMING');

-- AlterTable
ALTER TABLE "stored_file" ADD COLUMN     "emailMessageId" TEXT;

-- CreateTable
CREATE TABLE "email_message" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "direction" "EmailDirection" NOT NULL,
    "messageId" TEXT NOT NULL,
    "inReplyTo" TEXT NOT NULL DEFAULT '',
    "references" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT NOT NULL DEFAULT '',
    "toAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bodyText" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailbox_state" (
    "id" TEXT NOT NULL,
    "uidValidity" BIGINT,
    "lastUid" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailbox_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_message_messageId_key" ON "email_message"("messageId");

-- CreateIndex
CREATE INDEX "email_message_clientId_date_idx" ON "email_message"("clientId", "date");

-- CreateIndex
CREATE INDEX "email_message_direction_readAt_idx" ON "email_message"("direction", "readAt");

-- CreateIndex
CREATE INDEX "stored_file_emailMessageId_idx" ON "stored_file"("emailMessageId");

-- AddForeignKey
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_emailMessageId_fkey" FOREIGN KEY ("emailMessageId") REFERENCES "email_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

