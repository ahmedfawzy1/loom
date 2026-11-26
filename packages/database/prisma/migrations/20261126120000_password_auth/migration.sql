-- Email and password sign-in replaces Cloudflare Access. Accounts are invite-only: an Admin adds a
-- person with a role, and the account is PENDING until its owner chooses a password.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'USER_INVITED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_PASSWORD_RESET';

-- Existing rows, so this applies to a database that has them. Nobody has a password yet, so nobody
-- is ACTIVE; an account that never got a role gets the narrowest one, and still cannot sign in until
-- an Admin sends its owner a link. Emails are compared lowercased from now on.
UPDATE "CmsUser" SET "role" = 'WRITER' WHERE "role" IS NULL;
UPDATE "CmsUser" SET "status" = 'PENDING' WHERE "status" = 'ACTIVE';
UPDATE "CmsUser" SET "email" = lower("email") WHERE "email" <> lower("email");

-- AlterTable
-- A rename rather than Prisma's drop-and-add, so each row keeps the date it was created
ALTER TABLE "CmsUser" RENAME COLUMN "firstSeenAt" TO "createdAt";
ALTER TABLE "CmsUser" ALTER COLUMN "role" SET NOT NULL,
ALTER COLUMN "lastActiveAt" DROP NOT NULL,
ALTER COLUMN "lastActiveAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CmsPassword" (
    "userId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsPassword_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CmsPasswordLink" (
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CmsPasswordLink_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CmsSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CmsSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CmsPasswordLink_tokenHash_key" ON "CmsPasswordLink"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "CmsSession_tokenHash_key" ON "CmsSession"("tokenHash");

-- CreateIndex
CREATE INDEX "CmsSession_userId_idx" ON "CmsSession"("userId");

-- CreateIndex
CREATE INDEX "CmsSession_expiresAt_idx" ON "CmsSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "CmsPassword" ADD CONSTRAINT "CmsPassword_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CmsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPasswordLink" ADD CONSTRAINT "CmsPasswordLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CmsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsSession" ADD CONSTRAINT "CmsSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CmsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
