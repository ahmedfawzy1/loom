-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "previewSecret" TEXT,
ADD COLUMN     "previewUrl" TEXT;

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "canPreview" BOOLEAN NOT NULL DEFAULT false;

