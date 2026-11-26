import { CmsRole, CmsUserStatus, PrismaClient } from "../generated/client";
import { hashPassword, normalizeEmail } from "../src/credentials";
import { DEFAULT_SITE_LANGUAGES } from "../src/languages";

const prisma = new PrismaClient();

// Brand and product names DeepL must leave untranslated on the demo site
const PROTECTED_TERMS = ["Acme", "Acme Cloud", "Acme Studio"];

// The minimum the CMS needs to be usable: one Site with its languages, one Space and an Admin.
// Real sites are added in Settings → Sites. Demo content is a separate step: `pnpm db:seed:demo`.
// No refresh URL: there is no website behind the demo site to tell about publishes.
async function main() {
  const site = await prisma.site.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Site",
      slug: "demo",
      domain: "example.com",
      defaultLanguage: "en",
      protectedTerms: PROTECTED_TERMS,
    },
  });

  await Promise.all(
    DEFAULT_SITE_LANGUAGES.map((language, position) =>
      prisma.siteLanguage.upsert({
        where: { siteId_code: { siteId: site.id, code: language.code } },
        update: { ...language, position },
        create: { ...language, position, siteId: site.id },
      }),
    ),
  );

  const space = await prisma.space.upsert({
    where: { siteId_slug: { siteId: site.id, slug: "production" } },
    update: {},
    create: { siteId: site.id, name: "Production", slug: "production" },
  });

  await prisma.featuredArticles.upsert({
    where: { spaceId: space.id },
    update: {},
    create: { spaceId: space.id },
  });

  // No default password in code: one that ships with the source would sign anyone in to an
  // install someone seeded by mistake
  const adminEmail = process.env.CMS_SEED_ADMIN_EMAIL;
  const adminPassword = process.env.CMS_SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword)
    throw new Error(
      "Set CMS_SEED_ADMIN_EMAIL and CMS_SEED_ADMIN_PASSWORD in packages/database/.env — without them nobody could sign in locally",
    );

  const email = normalizeEmail(adminEmail);
  const admin = await prisma.cmsUser.upsert({
    where: { email },
    update: { role: CmsRole.ADMIN, status: CmsUserStatus.ACTIVE },
    create: {
      email,
      name: "Local Admin",
      role: CmsRole.ADMIN,
      status: CmsUserStatus.ACTIVE,
    },
  });

  const hash = await hashPassword(adminPassword);
  await prisma.cmsPassword.upsert({
    where: { userId: admin.id },
    update: { hash },
    create: { userId: admin.id, hash },
  });

  console.log(
    `Seeded site ${site.slug} with ${DEFAULT_SITE_LANGUAGES.length} languages, space ${space.slug}, admin ${email} (password from CMS_SEED_ADMIN_PASSWORD)`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
