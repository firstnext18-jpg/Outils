-- CreateEnum
CREATE TYPE "ListKind" AS ENUM ('CLIENT_STAGE', 'EXPENSE_CATEGORY', 'PROJECT_STEP');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DONE');

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('UNKNOWN', 'UP', 'DOWN');

-- AlterTable
ALTER TABLE "client" ADD COLUMN     "stageId" TEXT;

-- AlterTable
ALTER TABLE "quote" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "hourlyRateCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "monitorAlertEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "quoteReminderBodyDe" TEXT NOT NULL DEFAULT 'Guten Tag

Unsere Offerte {numero} über {montant} ist gültig bis {echeance}.

Sie können sie online ansehen und uns Ihre Antwort geben: {lien}

Für Fragen stehen wir Ihnen gerne zur Verfügung.

Freundliche Grüsse
{entreprise}',
ADD COLUMN     "quoteReminderBodyFr" TEXT NOT NULL DEFAULT 'Bonjour,

Notre devis {numero} d''un montant de {montant} est valable jusqu''au {echeance}.

Vous pouvez le consulter et nous donner votre réponse en ligne : {lien}

Nous restons à votre disposition pour toute question.

Meilleures salutations
{entreprise}',
ADD COLUMN     "quoteReminderDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "quoteReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quoteReminderSubjectDe" TEXT NOT NULL DEFAULT 'Erinnerung: Offerte {numero}',
ADD COLUMN     "quoteReminderSubjectFr" TEXT NOT NULL DEFAULT 'Rappel : devis {numero}',
ADD COLUMN     "renewalReminderDays" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "list_item" (
    "id" TEXT NOT NULL,
    "kind" "ListKind" NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_file" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "messageId" TEXT,
    "expenseId" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageName" TEXT NOT NULL,
    "visibleToClient" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "uploadedByClient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "quoteId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE,
    "dueDate" DATE,
    "hourlyRateCents" INTEGER,
    "budgetMinutes" INTEGER,
    "showHoursToClient" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_step" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,

    CONSTRAINT "project_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "description" TEXT NOT NULL DEFAULT '',
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "supplier" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "categoryId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "vatRateBps" INTEGER,
    "vatCents" INTEGER NOT NULL DEFAULT 0,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "clientId" TEXT,
    "projectId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_import" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "paymentCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "bank_import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transaction" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "bookingDate" DATE NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "creditorReference" TEXT NOT NULL DEFAULT '',
    "debtorName" TEXT NOT NULL DEFAULT '',
    "remittance" TEXT NOT NULL DEFAULT '',
    "paymentId" TEXT NOT NULL,

    CONSTRAINT "bank_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "registrar" TEXT NOT NULL DEFAULT '',
    "domainExpiresAt" DATE,
    "domainExpiryAuto" BOOLEAN NOT NULL DEFAULT true,
    "domainCheckedAt" TIMESTAMP(3),
    "hostingProvider" TEXT NOT NULL DEFAULT '',
    "hostingRenewsAt" DATE,
    "notes" TEXT NOT NULL DEFAULT '',
    "monitor" BOOLEAN NOT NULL DEFAULT true,
    "showStatusToClient" BOOLEAN NOT NULL DEFAULT true,
    "status" "SiteStatus" NOT NULL DEFAULT 'UNKNOWN',
    "statusChangedAt" TIMESTAMP(3),
    "lastCheckAt" TIMESTAMP(3),
    "lastResponseMs" INTEGER,
    "lastError" TEXT NOT NULL DEFAULT '',
    "failures" INTEGER NOT NULL DEFAULT 0,
    "sslExpiresAt" TIMESTAMP(3),
    "domainReminderFor" DATE,
    "hostingReminderFor" DATE,
    "sslReminderFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_incident" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "error" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "site_incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_feed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_feed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "list_item_kind_position_idx" ON "list_item"("kind", "position");

-- CreateIndex
CREATE UNIQUE INDEX "list_item_kind_name_key" ON "list_item"("kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "stored_file_storageName_key" ON "stored_file"("storageName");

-- CreateIndex
CREATE INDEX "stored_file_clientId_createdAt_idx" ON "stored_file"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "stored_file_projectId_idx" ON "stored_file"("projectId");

-- CreateIndex
CREATE INDEX "stored_file_messageId_idx" ON "stored_file"("messageId");

-- CreateIndex
CREATE INDEX "stored_file_expenseId_idx" ON "stored_file"("expenseId");

-- CreateIndex
CREATE INDEX "project_clientId_idx" ON "project"("clientId");

-- CreateIndex
CREATE INDEX "project_status_idx" ON "project"("status");

-- CreateIndex
CREATE INDEX "project_step_projectId_position_idx" ON "project_step"("projectId", "position");

-- CreateIndex
CREATE INDEX "time_entry_clientId_date_idx" ON "time_entry"("clientId", "date");

-- CreateIndex
CREATE INDEX "time_entry_projectId_idx" ON "time_entry"("projectId");

-- CreateIndex
CREATE INDEX "time_entry_userId_startedAt_idx" ON "time_entry"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "time_entry_invoiceId_idx" ON "time_entry"("invoiceId");

-- CreateIndex
CREATE INDEX "expense_date_idx" ON "expense"("date");

-- CreateIndex
CREATE INDEX "expense_categoryId_idx" ON "expense"("categoryId");

-- CreateIndex
CREATE INDEX "expense_clientId_idx" ON "expense"("clientId");

-- CreateIndex
CREATE INDEX "bank_import_createdAt_idx" ON "bank_import"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transaction_key_key" ON "bank_transaction"("key");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transaction_paymentId_key" ON "bank_transaction"("paymentId");

-- CreateIndex
CREATE INDEX "site_clientId_idx" ON "site"("clientId");

-- CreateIndex
CREATE INDEX "site_monitor_idx" ON "site"("monitor");

-- CreateIndex
CREATE INDEX "site_incident_siteId_startedAt_idx" ON "site_incident"("siteId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_feed_userId_key" ON "calendar_feed"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_feed_tokenHash_key" ON "calendar_feed"("tokenHash");

-- CreateIndex
CREATE INDEX "client_stageId_idx" ON "client"("stageId");

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "list_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "discussion_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_step" ADD CONSTRAINT "project_step_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_step" ADD CONSTRAINT "project_step_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "list_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_import" ADD CONSTRAINT "bank_import_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "bank_import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site" ADD CONSTRAINT "site_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_incident" ADD CONSTRAINT "site_incident_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_feed" ADD CONSTRAINT "calendar_feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Listes par défaut, modifiables dans Paramètres → Listes. Une migration ne
-- s'exécute qu'une fois par base : ce qui est ensuite supprimé ne réapparaît pas.
-- ---------------------------------------------------------------------------
INSERT INTO "list_item" ("id", "kind", "name", "position", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t.kind::"ListKind", t.name, t.position, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('CLIENT_STAGE', 'À contacter', 0),
  ('CLIENT_STAGE', 'En discussion', 1),
  ('CLIENT_STAGE', 'Projet en cours', 2),
  ('CLIENT_STAGE', 'En attente du client', 3),
  ('CLIENT_STAGE', 'Maintenance', 4),
  ('CLIENT_STAGE', 'Terminé', 5),
  ('EXPENSE_CATEGORY', 'Hébergement et domaines', 0),
  ('EXPENSE_CATEGORY', 'Logiciels et abonnements', 1),
  ('EXPENSE_CATEGORY', 'Matériel', 2),
  ('EXPENSE_CATEGORY', 'Sous-traitance', 3),
  ('EXPENSE_CATEGORY', 'Publicité', 4),
  ('EXPENSE_CATEGORY', 'Déplacements', 5),
  ('EXPENSE_CATEGORY', 'Frais bancaires', 6),
  ('EXPENSE_CATEGORY', 'Divers', 7),
  ('PROJECT_STEP', 'Brief et contenus', 0),
  ('PROJECT_STEP', 'Maquette', 1),
  ('PROJECT_STEP', 'Développement', 2),
  ('PROJECT_STEP', 'Tests et corrections', 3),
  ('PROJECT_STEP', 'Mise en ligne', 4)
) AS t(kind, name, position)
WHERE NOT EXISTS (SELECT 1 FROM "list_item");
