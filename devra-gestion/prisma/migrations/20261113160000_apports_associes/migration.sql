-- CreateEnum
CREATE TYPE "PartnerMovementKind" AS ENUM ('CAPITAL_IN', 'LOAN_IN', 'LOAN_OUT', 'CAPITAL_OUT');

-- AlterTable
ALTER TABLE "stored_file" ADD COLUMN     "partnerMovementId" TEXT;

-- CreateTable
CREATE TABLE "partner_movement" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "kind" "PartnerMovementKind" NOT NULL,
    "date" DATE NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "partner_movement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_movement_date_idx" ON "partner_movement"("date");

-- CreateIndex
CREATE INDEX "partner_movement_partnerId_idx" ON "partner_movement"("partnerId");

-- CreateIndex
CREATE INDEX "stored_file_partnerMovementId_idx" ON "stored_file"("partnerMovementId");

-- AddForeignKey
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_partnerMovementId_fkey" FOREIGN KEY ("partnerMovementId") REFERENCES "partner_movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_movement" ADD CONSTRAINT "partner_movement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_movement" ADD CONSTRAINT "partner_movement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

