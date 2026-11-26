/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `Media` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Media_deletedAt_createdAt_idx";

-- AlterTable
ALTER TABLE "Media" DROP COLUMN "deletedAt";

-- CreateIndex
CREATE INDEX "Media_createdAt_idx" ON "Media"("createdAt");
