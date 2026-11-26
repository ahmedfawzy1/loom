// The database types and enums the web app may use. The web app depends on @loom/dto and not on
// @loom/database, so this list is where the schema crosses into the frontend: to use another model
// or enum there, add it here. web/biome.json rejects a direct @loom/database import.
//
// A subpath of its own, like ./constants, because the enums are runtime values and the package root
// would bring every decorated DTO class into the browser bundle with them. In the browser they
// resolve to Prisma's browser build, which carries the enums but no query engine.
import type { Prisma } from "@loom/database";

export type {
  ApiKey,
  Author,
  Blog,
  BlogTag,
  BlogVersion,
  Category,
  CmsUser,
  Cta,
  FeaturedArticles,
  McpToken,
  Media,
  PendingUpload,
  Site,
  SiteLanguage,
  Space,
  Tag,
} from "@loom/database";
export {
  AuditAction,
  CmsContentType,
  CmsRole,
  CmsUserStatus,
  DEFAULT_SITE_LANGUAGES,
  LocaleStatus,
} from "@loom/database";

export type JsonValue = Prisma.JsonValue;
