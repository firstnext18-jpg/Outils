-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "SequenceKind" AS ENUM ('QUOTE', 'INVOICE');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REFUSED', 'EXPIRED');

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "documentFooterDe" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "documentFooterFr" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "invoiceNumberFormat" TEXT NOT NULL DEFAULT 'F-{AAAA}-{NNN}',
ADD COLUMN     "paymentTermDays" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "quoteConditionsDe" TEXT NOT NULL DEFAULT 'Alle Preise verstehen sich in Schweizer Franken. Die Rechnung ist innerhalb der darauf angegebenen Frist zahlbar. Für Fragen stehen wir Ihnen gerne zur Verfügung.',
ADD COLUMN     "quoteConditionsFr" TEXT NOT NULL DEFAULT 'Les prix s''entendent en francs suisses. La facture est payable dans le délai indiqué sur celle-ci. Nous restons à votre disposition pour toute question.',
ADD COLUMN     "quoteIntroDe" TEXT NOT NULL DEFAULT 'Vielen Dank für Ihr Interesse an unseren Dienstleistungen. Gerne unterbreiten wir Ihnen unsere Offerte.',
ADD COLUMN     "quoteIntroFr" TEXT NOT NULL DEFAULT 'Nous vous remercions de l''intérêt que vous portez à nos services et avons le plaisir de vous soumettre notre offre.',
ADD COLUMN     "quoteNumberFormat" TEXT NOT NULL DEFAULT 'D-{AAAA}-{NNN}',
ADD COLUMN     "quoteValidityDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vatNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vatRates" INTEGER[] DEFAULT ARRAY[810, 260, 380]::INTEGER[];

-- CreateTable
CREATE TABLE "number_sequence" (
    "kind" "SequenceKind" NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_sequence_pkey" PRIMARY KEY ("kind","year")
);

-- CreateTable
CREATE TABLE "quote" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "language" "DocumentLanguage" NOT NULL,
    "issueDate" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "siteTypeId" TEXT,
    "introText" TEXT NOT NULL DEFAULT '',
    "conditionsText" TEXT NOT NULL DEFAULT '',
    "globalDiscountType" "DiscountType",
    "globalDiscountValue" INTEGER NOT NULL DEFAULT 0,
    "depositType" "DiscountType",
    "depositValue" INTEGER NOT NULL DEFAULT 0,
    "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "vatCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "depositCents" INTEGER NOT NULL DEFAULT 0,
    "recurringMonthlyCents" INTEGER NOT NULL DEFAULT 0,
    "recurringQuarterlyCents" INTEGER NOT NULL DEFAULT 0,
    "recurringYearlyCents" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "clientSnapshot" JSONB,
    "companySnapshot" JSONB,
    "searchText" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "catalogItemId" TEXT,
    "lineType" "LineType" NOT NULL,
    "periodicity" "Periodicity",
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "quantityMilli" INTEGER NOT NULL,
    "unit" "Unit" NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "discountType" "DiscountType",
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    "vatRateBps" INTEGER,
    "netCents" INTEGER NOT NULL,

    CONSTRAINT "quote_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quote_number_key" ON "quote"("number");

-- CreateIndex
CREATE INDEX "quote_clientId_idx" ON "quote"("clientId");

-- CreateIndex
CREATE INDEX "quote_status_idx" ON "quote"("status");

-- CreateIndex
CREATE INDEX "quote_issueDate_idx" ON "quote"("issueDate");

-- CreateIndex
CREATE INDEX "quote_line_quoteId_idx" ON "quote_line"("quoteId");

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_siteTypeId_fkey" FOREIGN KEY ("siteTypeId") REFERENCES "site_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line" ADD CONSTRAINT "quote_line_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line" ADD CONSTRAINT "quote_line_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "catalog_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
