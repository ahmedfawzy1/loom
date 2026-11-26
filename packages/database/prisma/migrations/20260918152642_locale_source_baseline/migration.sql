-- AlterTable
ALTER TABLE "AuthorLocale" ADD COLUMN     "sourceBaseline" JSONB;

-- AlterTable
ALTER TABLE "BlogLocale" ADD COLUMN     "sourceBaseline" JSONB;

-- AlterTable
ALTER TABLE "CategoryLocale" ADD COLUMN     "sourceBaseline" JSONB;

-- AlterTable
ALTER TABLE "CtaLocale" ADD COLUMN     "sourceBaseline" JSONB;

-- AlterTable
ALTER TABLE "FeaturedArticlesLocale" ADD COLUMN     "sourceBaseline" JSONB;

-- AlterTable
ALTER TABLE "TagLocale" ADD COLUMN     "sourceBaseline" JSONB;
