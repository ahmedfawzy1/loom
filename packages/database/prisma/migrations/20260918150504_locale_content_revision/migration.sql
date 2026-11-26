-- AlterTable
ALTER TABLE "AuthorLocale" ADD COLUMN     "contentRevision" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "BlogLocale" ADD COLUMN     "contentRevision" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "CategoryLocale" ADD COLUMN     "contentRevision" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "CtaLocale" ADD COLUMN     "contentRevision" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "FeaturedArticlesLocale" ADD COLUMN     "contentRevision" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TagLocale" ADD COLUMN     "contentRevision" INTEGER NOT NULL DEFAULT 1;

-- Every existing locale's content is as of its current revision
UPDATE "BlogLocale" SET "contentRevision" = "revision";
UPDATE "CategoryLocale" SET "contentRevision" = "revision";
UPDATE "TagLocale" SET "contentRevision" = "revision";
UPDATE "AuthorLocale" SET "contentRevision" = "revision";
UPDATE "CtaLocale" SET "contentRevision" = "revision";
UPDATE "FeaturedArticlesLocale" SET "contentRevision" = "revision";
