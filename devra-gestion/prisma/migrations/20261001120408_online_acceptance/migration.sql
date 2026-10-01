-- AlterTable
ALTER TABLE "quote" ADD COLUMN     "decidedOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "decisionComment" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "decisionIp" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "decisionName" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "onlineAcceptance" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "quoteEmailBodyDe" SET DEFAULT 'Guten Tag

Beiliegend erhalten Sie unsere Offerte {numero} über {montant}, gültig bis {echeance}.

Sie können die Offerte online ansehen und annehmen: {lien}

Für Fragen stehen wir Ihnen gerne zur Verfügung.

Freundliche Grüsse
{entreprise}',
ALTER COLUMN "quoteEmailBodyFr" SET DEFAULT 'Bonjour,

Veuillez trouver ci-joint notre devis {numero} d''un montant de {montant}, valable jusqu''au {echeance}.

Vous pouvez le consulter et l''accepter en ligne : {lien}

Nous restons à votre disposition pour toute question.

Meilleures salutations
{entreprise}';

-- CreateTable
CREATE TABLE "quote_link" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quote_link_tokenHash_key" ON "quote_link"("tokenHash");

-- CreateIndex
CREATE INDEX "quote_link_quoteId_idx" ON "quote_link"("quoteId");

-- AddForeignKey
ALTER TABLE "quote_link" ADD CONSTRAINT "quote_link_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Modèles d'emails des devis jamais modifiés : ajout de la ligne du lien d'acceptation en ligne
-- (elle n'apparaît pas dans les emails tant que l'option est désactivée).
UPDATE "settings" SET "quoteEmailBodyFr" = 'Bonjour,

Veuillez trouver ci-joint notre devis {numero} d''un montant de {montant}, valable jusqu''au {echeance}.

Vous pouvez le consulter et l''accepter en ligne : {lien}

Nous restons à votre disposition pour toute question.

Meilleures salutations
{entreprise}' WHERE "quoteEmailBodyFr" = 'Bonjour,

Veuillez trouver ci-joint notre devis {numero} d''un montant de {montant}, valable jusqu''au {echeance}.

Nous restons à votre disposition pour toute question.

Meilleures salutations
{entreprise}';
UPDATE "settings" SET "quoteEmailBodyDe" = 'Guten Tag

Beiliegend erhalten Sie unsere Offerte {numero} über {montant}, gültig bis {echeance}.

Sie können die Offerte online ansehen und annehmen: {lien}

Für Fragen stehen wir Ihnen gerne zur Verfügung.

Freundliche Grüsse
{entreprise}' WHERE "quoteEmailBodyDe" = 'Guten Tag

Beiliegend erhalten Sie unsere Offerte {numero} über {montant}, gültig bis {echeance}.

Für Fragen stehen wir Ihnen gerne zur Verfügung.

Freundliche Grüsse
{entreprise}';
