-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED');

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "invoiceEmailBodyDe" TEXT NOT NULL DEFAULT 'Guten Tag

Beiliegend erhalten Sie unsere Rechnung {numero} über {montant}, zahlbar bis {echeance}. Den Einzahlungsschein (QR-Rechnung) finden Sie unten auf dem Dokument.

Vielen Dank für Ihr Vertrauen.

Freundliche Grüsse
{entreprise}',
ADD COLUMN     "invoiceEmailBodyFr" TEXT NOT NULL DEFAULT 'Bonjour,

Veuillez trouver ci-joint notre facture {numero} d''un montant de {montant}, payable d''ici au {echeance}. Le bulletin de paiement (QR-facture) figure au bas du document.

Nous vous remercions de votre confiance.

Meilleures salutations
{entreprise}',
ADD COLUMN     "invoiceEmailSubjectDe" TEXT NOT NULL DEFAULT 'Rechnung {numero}',
ADD COLUMN     "invoiceEmailSubjectFr" TEXT NOT NULL DEFAULT 'Facture {numero}',
ADD COLUMN     "quoteEmailBodyDe" TEXT NOT NULL DEFAULT 'Guten Tag

Beiliegend erhalten Sie unsere Offerte {numero} über {montant}, gültig bis {echeance}.

Für Fragen stehen wir Ihnen gerne zur Verfügung.

Freundliche Grüsse
{entreprise}',
ADD COLUMN     "quoteEmailBodyFr" TEXT NOT NULL DEFAULT 'Bonjour,

Veuillez trouver ci-joint notre devis {numero} d''un montant de {montant}, valable jusqu''au {echeance}.

Nous restons à votre disposition pour toute question.

Meilleures salutations
{entreprise}',
ADD COLUMN     "quoteEmailSubjectDe" TEXT NOT NULL DEFAULT 'Offerte {numero}',
ADD COLUMN     "quoteEmailSubjectFr" TEXT NOT NULL DEFAULT 'Devis {numero}';

-- CreateTable
CREATE TABLE "email_log" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT,
    "invoiceId" TEXT,
    "recipients" TEXT[],
    "bcc" TEXT[],
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachment" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "error" TEXT NOT NULL DEFAULT '',
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_log_quoteId_idx" ON "email_log"("quoteId");

-- CreateIndex
CREATE INDEX "email_log_invoiceId_idx" ON "email_log"("invoiceId");

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
