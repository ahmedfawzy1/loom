-- CreateEnum
CREATE TYPE "CmsRole" AS ENUM ('ADMIN', 'AUTHOR', 'WRITER');

-- CreateEnum
CREATE TYPE "CmsUserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "LocaleStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'CHANGED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "CmsContentType" AS ENUM ('BLOG', 'CATEGORY', 'TAG', 'AUTHOR', 'CTA', 'FEATURED_ARTICLES');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CONTENT_CREATED', 'CONTENT_EDITED', 'CONTENT_SUBMITTED', 'CONTENT_APPROVED', 'CONTENT_CHANGES_REQUESTED', 'CONTENT_PUBLISHED', 'CONTENT_UNPUBLISHED', 'CONTENT_TRANSLATED', 'CONTENT_DUPLICATED', 'CONTENT_TRASHED', 'CONTENT_RESTORED', 'CONTENT_DELETED', 'VERSION_RESTORED', 'MEDIA_UPLOADED', 'MEDIA_REPLACED', 'MEDIA_DELETED', 'USER_ROLE_CHANGED', 'USER_DISABLED', 'USER_REACTIVATED', 'USER_DELETED', 'SITE_CREATED', 'SITE_UPDATED', 'SITE_DELETED', 'SPACE_CREATED', 'SPACE_RENAMED', 'SPACE_CLONED', 'SPACE_DELETED', 'SETTINGS_CHANGED', 'API_KEY_CREATED', 'API_KEY_REVOKED', 'PAGES_REFRESHED');

-- CreateTable
CREATE TABLE "CmsUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "CmsRole",
    "status" "CmsUserStatus" NOT NULL DEFAULT 'PENDING',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CmsUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "protectedTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "revalidateUrl" TEXT,
    "revalidateSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteLanguage" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "nativeName" TEXT NOT NULL,
    "deeplCode" TEXT,
    "urlPrefix" TEXT NOT NULL,
    "rtl" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,

    CONSTRAINT "SiteLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "altText" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blog" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "categoryId" TEXT,
    "imageId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Blog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogTag" (
    "blogId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "BlogTag_pkey" PRIMARY KEY ("blogId","tagId")
);

-- CreateTable
CREATE TABLE "BlogLocale" (
    "id" TEXT NOT NULL,
    "blogId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "updateNote" TEXT,
    "body" JSONB NOT NULL,
    "faq" JSONB NOT NULL DEFAULT '[]',
    "status" "LocaleStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "sourceRevision" INTEGER,
    "firstPublishedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedRevision" INTEGER,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogVersion" (
    "id" TEXT NOT NULL,
    "blogLocaleId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "gameCode" TEXT NOT NULL,
    "featuredImageId" TEXT,
    "featureIconId" TEXT,
    "gameCoverId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryLocale" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "seoMetaTitle" TEXT,
    "seoMetaDescription" TEXT,
    "status" "LocaleStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "sourceRevision" INTEGER,
    "firstPublishedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedRevision" INTEGER,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryVersion" (
    "id" TEXT NOT NULL,
    "categoryLocaleId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "featuredImageId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagLocale" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "LocaleStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "sourceRevision" INTEGER,
    "firstPublishedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedRevision" INTEGER,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagVersion" (
    "id" TEXT NOT NULL,
    "tagLocaleId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Author" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profileImageId" TEXT,
    "socialLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorLocale" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "jobTitle" TEXT,
    "bio" TEXT,
    "status" "LocaleStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "sourceRevision" INTEGER,
    "firstPublishedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedRevision" INTEGER,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorVersion" (
    "id" TEXT NOT NULL,
    "authorLocaleId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cta" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cmpid" TEXT,
    "imageId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Cta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CtaLocale" (
    "id" TEXT NOT NULL,
    "ctaId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "buttonLabel" TEXT NOT NULL,
    "status" "LocaleStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "sourceRevision" INTEGER,
    "firstPublishedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedRevision" INTEGER,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CtaLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CtaVersion" (
    "id" TEXT NOT NULL,
    "ctaLocaleId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CtaVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedArticles" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FeaturedArticles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedArticlesLocale" (
    "id" TEXT NOT NULL,
    "featuredArticlesId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "status" "LocaleStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "sourceRevision" INTEGER,
    "firstPublishedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedRevision" INTEGER,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedArticlesLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedArticlesItem" (
    "id" TEXT NOT NULL,
    "localeId" TEXT NOT NULL,
    "blogId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "FeaturedArticlesItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedArticlesVersion" (
    "id" TEXT NOT NULL,
    "featuredArticlesLocaleId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeaturedArticlesVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 600,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "contentType" "CmsContentType",
    "contentId" TEXT,
    "languageCode" TEXT,
    "spaceId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationUsage" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "contentType" "CmsContentType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "characters" INTEGER NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranslationUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CmsUser_email_key" ON "CmsUser"("email");

-- CreateIndex
CREATE INDEX "CmsUser_status_idx" ON "CmsUser"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Site_slug_key" ON "Site"("slug");

-- CreateIndex
CREATE INDEX "SiteLanguage_siteId_enabled_idx" ON "SiteLanguage"("siteId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "SiteLanguage_siteId_code_key" ON "SiteLanguage"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Space_siteId_slug_key" ON "Space"("siteId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Space_siteId_name_key" ON "Space"("siteId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Media_s3Key_key" ON "Media"("s3Key");

-- CreateIndex
CREATE INDEX "Media_deletedAt_createdAt_idx" ON "Media"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Blog_spaceId_deletedAt_idx" ON "Blog"("spaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "Blog_categoryId_idx" ON "Blog"("categoryId");

-- CreateIndex
CREATE INDEX "Blog_authorId_idx" ON "Blog"("authorId");

-- CreateIndex
CREATE INDEX "Blog_reviewerId_idx" ON "Blog"("reviewerId");

-- CreateIndex
CREATE INDEX "BlogTag_tagId_idx" ON "BlogTag"("tagId");

-- CreateIndex
CREATE INDEX "BlogLocale_spaceId_languageCode_status_idx" ON "BlogLocale"("spaceId", "languageCode", "status");

-- CreateIndex
CREATE INDEX "BlogLocale_status_idx" ON "BlogLocale"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BlogLocale_blogId_languageCode_key" ON "BlogLocale"("blogId", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "BlogLocale_spaceId_languageCode_slug_key" ON "BlogLocale"("spaceId", "languageCode", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "BlogVersion_blogLocaleId_revision_key" ON "BlogVersion"("blogLocaleId", "revision");

-- CreateIndex
CREATE INDEX "Category_spaceId_deletedAt_idx" ON "Category"("spaceId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_spaceId_slug_key" ON "Category"("spaceId", "slug");

-- CreateIndex
CREATE INDEX "CategoryLocale_spaceId_languageCode_status_idx" ON "CategoryLocale"("spaceId", "languageCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryLocale_categoryId_languageCode_key" ON "CategoryLocale"("categoryId", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryLocale_spaceId_languageCode_seoMetaTitle_key" ON "CategoryLocale"("spaceId", "languageCode", "seoMetaTitle");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryVersion_categoryLocaleId_revision_key" ON "CategoryVersion"("categoryLocaleId", "revision");

-- CreateIndex
CREATE INDEX "Tag_spaceId_deletedAt_idx" ON "Tag"("spaceId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_spaceId_slug_key" ON "Tag"("spaceId", "slug");

-- CreateIndex
CREATE INDEX "TagLocale_spaceId_languageCode_status_idx" ON "TagLocale"("spaceId", "languageCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TagLocale_tagId_languageCode_key" ON "TagLocale"("tagId", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "TagVersion_tagLocaleId_revision_key" ON "TagVersion"("tagLocaleId", "revision");

-- CreateIndex
CREATE INDEX "Author_spaceId_deletedAt_idx" ON "Author"("spaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "AuthorLocale_spaceId_languageCode_status_idx" ON "AuthorLocale"("spaceId", "languageCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorLocale_authorId_languageCode_key" ON "AuthorLocale"("authorId", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorVersion_authorLocaleId_revision_key" ON "AuthorVersion"("authorLocaleId", "revision");

-- CreateIndex
CREATE INDEX "Cta_spaceId_deletedAt_idx" ON "Cta"("spaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "Cta_spaceId_cmpid_idx" ON "Cta"("spaceId", "cmpid");

-- CreateIndex
CREATE INDEX "CtaLocale_spaceId_languageCode_status_idx" ON "CtaLocale"("spaceId", "languageCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CtaLocale_ctaId_languageCode_key" ON "CtaLocale"("ctaId", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "CtaVersion_ctaLocaleId_revision_key" ON "CtaVersion"("ctaLocaleId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedArticles_spaceId_key" ON "FeaturedArticles"("spaceId");

-- CreateIndex
CREATE INDEX "FeaturedArticlesLocale_spaceId_languageCode_status_idx" ON "FeaturedArticlesLocale"("spaceId", "languageCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedArticlesLocale_featuredArticlesId_languageCode_key" ON "FeaturedArticlesLocale"("featuredArticlesId", "languageCode");

-- CreateIndex
CREATE INDEX "FeaturedArticlesItem_blogId_idx" ON "FeaturedArticlesItem"("blogId");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedArticlesItem_localeId_blogId_key" ON "FeaturedArticlesItem"("localeId", "blogId");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedArticlesVersion_featuredArticlesLocaleId_revision_key" ON "FeaturedArticlesVersion"("featuredArticlesLocaleId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_siteId_revokedAt_idx" ON "ApiKey"("siteId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_contentType_contentId_idx" ON "AuditLog"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "AuditLog_spaceId_createdAt_idx" ON "AuditLog"("spaceId", "createdAt");

-- CreateIndex
CREATE INDEX "TranslationUsage_siteId_createdAt_idx" ON "TranslationUsage"("siteId", "createdAt");

-- AddForeignKey
ALTER TABLE "SiteLanguage" ADD CONSTRAINT "SiteLanguage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "Author"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogTag" ADD CONSTRAINT "BlogTag_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogTag" ADD CONSTRAINT "BlogTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogLocale" ADD CONSTRAINT "BlogLocale_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogLocale" ADD CONSTRAINT "BlogLocale_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogLocale" ADD CONSTRAINT "BlogLocale_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogLocale" ADD CONSTRAINT "BlogLocale_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogVersion" ADD CONSTRAINT "BlogVersion_blogLocaleId_fkey" FOREIGN KEY ("blogLocaleId") REFERENCES "BlogLocale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_featuredImageId_fkey" FOREIGN KEY ("featuredImageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_featureIconId_fkey" FOREIGN KEY ("featureIconId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_gameCoverId_fkey" FOREIGN KEY ("gameCoverId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryLocale" ADD CONSTRAINT "CategoryLocale_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryLocale" ADD CONSTRAINT "CategoryLocale_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryLocale" ADD CONSTRAINT "CategoryLocale_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryLocale" ADD CONSTRAINT "CategoryLocale_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryVersion" ADD CONSTRAINT "CategoryVersion_categoryLocaleId_fkey" FOREIGN KEY ("categoryLocaleId") REFERENCES "CategoryLocale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_featuredImageId_fkey" FOREIGN KEY ("featuredImageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagLocale" ADD CONSTRAINT "TagLocale_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagLocale" ADD CONSTRAINT "TagLocale_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagLocale" ADD CONSTRAINT "TagLocale_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagLocale" ADD CONSTRAINT "TagLocale_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagVersion" ADD CONSTRAINT "TagVersion_tagLocaleId_fkey" FOREIGN KEY ("tagLocaleId") REFERENCES "TagLocale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Author" ADD CONSTRAINT "Author_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Author" ADD CONSTRAINT "Author_profileImageId_fkey" FOREIGN KEY ("profileImageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Author" ADD CONSTRAINT "Author_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorLocale" ADD CONSTRAINT "AuthorLocale_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorLocale" ADD CONSTRAINT "AuthorLocale_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorLocale" ADD CONSTRAINT "AuthorLocale_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorLocale" ADD CONSTRAINT "AuthorLocale_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorVersion" ADD CONSTRAINT "AuthorVersion_authorLocaleId_fkey" FOREIGN KEY ("authorLocaleId") REFERENCES "AuthorLocale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cta" ADD CONSTRAINT "Cta_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cta" ADD CONSTRAINT "Cta_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cta" ADD CONSTRAINT "Cta_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CtaLocale" ADD CONSTRAINT "CtaLocale_ctaId_fkey" FOREIGN KEY ("ctaId") REFERENCES "Cta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CtaLocale" ADD CONSTRAINT "CtaLocale_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CtaLocale" ADD CONSTRAINT "CtaLocale_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CtaLocale" ADD CONSTRAINT "CtaLocale_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CtaVersion" ADD CONSTRAINT "CtaVersion_ctaLocaleId_fkey" FOREIGN KEY ("ctaLocaleId") REFERENCES "CtaLocale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedArticles" ADD CONSTRAINT "FeaturedArticles_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedArticles" ADD CONSTRAINT "FeaturedArticles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedArticlesLocale" ADD CONSTRAINT "FeaturedArticlesLocale_featuredArticlesId_fkey" FOREIGN KEY ("featuredArticlesId") REFERENCES "FeaturedArticles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedArticlesLocale" ADD CONSTRAINT "FeaturedArticlesLocale_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedArticlesLocale" ADD CONSTRAINT "FeaturedArticlesLocale_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedArticlesLocale" ADD CONSTRAINT "FeaturedArticlesLocale_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedArticlesItem" ADD CONSTRAINT "FeaturedArticlesItem_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "FeaturedArticlesLocale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedArticlesItem" ADD CONSTRAINT "FeaturedArticlesItem_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedArticlesVersion" ADD CONSTRAINT "FeaturedArticlesVersion_featuredArticlesLocaleId_fkey" FOREIGN KEY ("featuredArticlesLocaleId") REFERENCES "FeaturedArticlesLocale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslationUsage" ADD CONSTRAINT "TranslationUsage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslationUsage" ADD CONSTRAINT "TranslationUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CmsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
