-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "Author_name_idx" ON "Author" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "BlogLocale_title_idx" ON "BlogLocale" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "CategoryLocale_title_idx" ON "CategoryLocale" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "CtaLocale_title_idx" ON "CtaLocale" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "TagLocale_title_idx" ON "TagLocale" USING GIN ("title" gin_trgm_ops);
