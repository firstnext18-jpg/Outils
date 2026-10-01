-- DropIndex
DROP INDEX "client_displayName_idx";

-- AlterTable
ALTER TABLE "client" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sortName" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "client_sortName_idx" ON "client"("sortName");
