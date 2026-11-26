-- DropIndex
DROP INDEX "Media_createdAt_idx";

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PendingUpload" (
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingUpload_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "PendingUpload_expiresAt_idx" ON "PendingUpload"("expiresAt");

-- CreateIndex
CREATE INDEX "Media_deletedAt_createdAt_idx" ON "Media"("deletedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "PendingUpload" ADD CONSTRAINT "PendingUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "CmsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
