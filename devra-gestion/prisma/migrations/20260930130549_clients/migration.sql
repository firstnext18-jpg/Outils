-- CreateEnum
CREATE TYPE "ClientKind" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "DocumentLanguage" AS ENUM ('FR', 'DE');

-- CreateEnum
CREATE TYPE "Canton" AS ENUM ('AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH');

-- CreateTable
CREATE TABLE "site_type" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "kind" "ClientKind" NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "companyName" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT NOT NULL,
    "street" TEXT NOT NULL DEFAULT '',
    "streetNumber" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "canton" "Canton",
    "country" TEXT NOT NULL DEFAULT 'CH',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "siteTypeId" TEXT,
    "language" "DocumentLanguage" NOT NULL DEFAULT 'FR',
    "notes" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "archivedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_type_name_key" ON "site_type"("name");

-- CreateIndex
CREATE INDEX "client_displayName_idx" ON "client"("displayName");

-- CreateIndex
CREATE INDEX "client_email_idx" ON "client"("email");

-- CreateIndex
CREATE INDEX "client_archivedAt_idx" ON "client"("archivedAt");

-- CreateIndex
CREATE INDEX "client_canton_idx" ON "client"("canton");

-- CreateIndex
CREATE INDEX "client_tags_idx" ON "client" USING GIN ("tags");

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_siteTypeId_fkey" FOREIGN KEY ("siteTypeId") REFERENCES "site_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
