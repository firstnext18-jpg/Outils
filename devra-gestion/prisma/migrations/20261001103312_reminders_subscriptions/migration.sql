-- CreateEnum
CREATE TYPE "ReminderMode" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'MANUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "email_log" ADD COLUMN     "reminderId" TEXT;

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN     "feesCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "periodEnd" DATE,
ADD COLUMN     "periodStart" DATE,
ADD COLUMN     "subscriptionId" TEXT;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "reminderDelay1" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "reminderDelay2" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "reminderDelay3" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "reminderFee1Cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reminderFee2Cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reminderFee3Cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reminderMode" "ReminderMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "reminderPaymentDays" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "reminderTemplates" JSONB,
ADD COLUMN     "subscriptionAutoSend" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "reminder" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "pdfFile" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "quoteId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "periodicity" "Periodicity" NOT NULL,
    "language" "DocumentLanguage" NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "billedPeriods" INTEGER NOT NULL DEFAULT 0,
    "nextBillingDate" DATE NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "endDate" DATE,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "searchText" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_item" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "catalogItemId" TEXT,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "quantityMilli" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "discountType" "DiscountType",
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    "vatRateBps" INTEGER,

    CONSTRAINT "subscription_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_run" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "summary" JSONB,
    "error" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,

    CONSTRAINT "task_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reminder_invoiceId_level_key" ON "reminder"("invoiceId", "level");

-- CreateIndex
CREATE INDEX "subscription_status_nextBillingDate_idx" ON "subscription"("status", "nextBillingDate");

-- CreateIndex
CREATE INDEX "subscription_clientId_idx" ON "subscription"("clientId");

-- CreateIndex
CREATE INDEX "subscription_item_subscriptionId_idx" ON "subscription_item"("subscriptionId");

-- CreateIndex
CREATE INDEX "task_run_startedAt_idx" ON "task_run"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_subscriptionId_periodStart_key" ON "invoice"("subscriptionId", "periodStart");

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "catalog_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_run" ADD CONSTRAINT "task_run_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

