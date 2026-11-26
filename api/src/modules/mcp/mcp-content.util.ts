import {
  type BlogLocale,
  CmsContentType,
  CmsRole,
  LocaleStatus,
  type Media,
  type Site,
  type SiteLanguage,
} from "@loom/database";
import { ListContentRequestDto } from "@loom/dto";
import { CONTENT_TYPE_PATHS, translationState } from "@loom/dto/constants";
import { BadRequestException } from "@nestjs/common";
import type { ClassConstructor } from "class-transformer";
import { z } from "zod";
import {
  type ContentRef,
  contentTitles,
  refKey,
} from "../content/content-titles.util";
import { MCP_PAGE_SIZE } from "./mcp.constants";
import type { McpContext } from "./mcp.context";
import { definedFields, validated } from "./mcp-tool.util";

export const spaceIdInput = z
  .string()
  .describe("A space's id, from list_sites.");

export const languageInput = z
  .string()
  .optional()
  .describe(
    'A language code from list_sites, like "en". Defaults to the site\'s default language.',
  );

export const pageInput = z
  .number()
  .int()
  .min(1)
  .default(1)
  .describe("Which page of results, from 1.");

export const pictureInput = (what: string) =>
  z
    .string()
    .nullable()
    .optional()
    .describe(`${what}: a picture's id from list_media, or null to remove it.`);

export const listInput = z.object({
  spaceId: spaceIdInput,
  language: languageInput.describe(
    "Whose titles to show and search, as a language code from list_sites. Defaults to the site's default language.",
  ),
  query: z
    .string()
    .optional()
    .describe("Matches titles and slugs in that language."),
  status: z
    .enum(LocaleStatus)
    .optional()
    .describe("Only items whose language is in this state."),
  page: pageInput,
});

/** How the tools name content types: one word each, the way a person would say it. */
export const ITEM_TYPES = {
  post: CmsContentType.BLOG,
  category: CmsContentType.CATEGORY,
  tag: CmsContentType.TAG,
  author: CmsContentType.AUTHOR,
  cta: CmsContentType.CTA,
  featured_posts: CmsContentType.FEATURED_ARTICLES,
} as const satisfies Record<string, CmsContentType>;

export type ItemTypeName = keyof typeof ITEM_TYPES;

export const itemTypeInput = z.enum([
  "post",
  "category",
  "tag",
  "author",
  "cta",
  "featured_posts",
] satisfies ItemTypeName[]);

export const itemTypeName = (type: CmsContentType): ItemTypeName =>
  (Object.keys(ITEM_TYPES) as ItemTypeName[]).find(
    (name) => ITEM_TYPES[name] === type,
  ) ?? "post";

/** Where a person edits, reviews and publishes an item in the Loom admin app. */
export const editorPath = (type: CmsContentType, id: string) =>
  type === CmsContentType.FEATURED_ARTICLES
    ? `/${CONTENT_TYPE_PATHS[type]}`
    : `/${CONTENT_TYPE_PATHS[type]}/${id}`;

type SiteLanguages = Pick<Site, "name" | "defaultLanguage"> & {
  languages: Pick<SiteLanguage, "code" | "enabled">[];
};

/** The language a call means: the one it names, which the site must have, or the site's default. */
export function languageOn(
  site: SiteLanguages,
  requested: string | undefined,
): SiteLanguage["code"] {
  const language = requested?.trim() || site.defaultLanguage;
  if (site.languages.some((candidate) => candidate.code === language))
    return language;

  const codes = site.languages
    .filter((candidate) => candidate.enabled)
    .map((candidate) => candidate.code);
  throw new BadRequestException(
    `"${language}" is not a language of ${site.name}. Use one of: ${codes.join(", ")}.`,
  );
}

type LocaleSummary = Pick<
  BlogLocale,
  | "languageCode"
  | "status"
  | "revision"
  | "publishedRevision"
  | "sourceRevision"
  | "contentRevision"
  | "publishedAt"
>;

type LocaleDetail = LocaleSummary &
  Partial<Pick<BlogLocale, "submittedAt" | "reviewNote">>;

const sourceOf = (locales: LocaleSummary[], defaultLanguage: string) =>
  locales.find((locale) => locale.languageCode === defaultLanguage);

/** Every language an item has: its status, whether readers see it, and whether it is behind. */
export function languageStates(
  locales: LocaleSummary[],
  defaultLanguage: string,
) {
  const source = sourceOf(locales, defaultLanguage);
  return locales.map((locale) => ({
    language: locale.languageCode,
    status: locale.status,
    live: locale.publishedRevision !== null,
    translation: translationState(locale, source),
  }));
}

/** One language in full, or null when the item has nothing in it yet. */
export function localeState(
  locales: LocaleDetail[],
  language: string,
  defaultLanguage: string,
) {
  const locale = locales.find(
    (candidate) => candidate.languageCode === language,
  );
  if (!locale) return null;

  return {
    status: locale.status,
    live: locale.publishedRevision !== null,
    revision: locale.revision,
    publishedRevision: locale.publishedRevision,
    publishedAt: locale.publishedAt,
    translation: translationState(locale, sourceOf(locales, defaultLanguage)),
    submittedAt: locale.submittedAt ?? null,
    reviewNote: locale.reviewNote ?? null,
  };
}

/** What a save leaves for a person to do, which depends on whether they can publish. */
function nextStep(ctx: McpContext, live: boolean) {
  const publish =
    ctx.user.role === CmsRole.WRITER
      ? "When it is ready, send it for review with submit_for_review."
      : "Publish it in Loom (editorPath) when it is ready.";
  return live
    ? `Saved as a new version. The site keeps showing the published one until this is published. ${publish}`
    : `Saved. It is not on the site. ${publish}`;
}

/** The answer to a save: where the language it wrote now stands. */
export function savedOutcome(
  ctx: McpContext,
  type: CmsContentType,
  item: { id: string; locales: LocaleSummary[] },
  language: string,
) {
  const locale = item.locales.find(
    (candidate) => candidate.languageCode === language,
  );
  const live = Boolean(locale && locale.publishedRevision !== null);
  return {
    id: item.id,
    language,
    status: locale?.status ?? null,
    live,
    revision: locale?.revision ?? null,
    editorPath: editorPath(type, item.id),
    next: nextStep(ctx, live),
  };
}

type ListArgs = z.infer<typeof listInput> & {
  categoryId?: string;
  tagId?: string;
  authorId?: string;
};

/** A content list, one row per item, with where every language of it stands. */
export async function listContent(
  ctx: McpContext,
  type: CmsContentType,
  input: ListArgs,
) {
  const { site } = await ctx.context.requireSpace(input.spaceId);
  const language = languageOn(site, input.language);
  const query = await validated(
    ListContentRequestDto,
    definedFields({
      spaceId: input.spaceId,
      language,
      q: input.query,
      status: input.status,
      categoryId: input.categoryId,
      tagId: input.tagId,
      authorId: input.authorId,
      page: input.page,
      pageSize: MCP_PAGE_SIZE,
    }),
  );
  const { items, pagination } = await ctx.query.list(
    type,
    query,
    site.defaultLanguage,
  );

  return {
    language,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      // false: the title is the default language's, since this item has nothing in `language` yet
      hasThisLanguage: item.hasRequestedLocale,
      languages: languageStates(item.locales, site.defaultLanguage),
      updatedAt: item.updatedAt,
    })),
    page: pagination.page,
    totalPages: pagination.totalPages,
    total: pagination.total,
  };
}

/** What to call each referenced item in `language`, falling back to its default language. */
export async function titlesOf(
  ctx: McpContext,
  refs: ContentRef[],
  language: string,
) {
  const titles = await contentTitles(ctx.prisma, refs, language);
  return (type: CmsContentType, id: string) =>
    titles.get(refKey({ type, id })) ?? null;
}

/** A picture as the tools show it, with the URL it is served from. */
export async function pictureOf(ctx: McpContext, mediaId: Media["id"] | null) {
  if (!mediaId) return null;
  try {
    const media = await ctx.media.get(mediaId);
    return { id: media.id, url: media.url, altText: media.altText };
  } catch {
    return { id: mediaId, url: null, altText: null };
  }
}

// Text and Shared are the DTOs the save is validated against, so they are inferred from those
// classes alone, never from the partial fields a call happens to send.
export interface SaveRequest<Text extends object, Shared extends object> {
  item: { spaceId: string };
  language: string | undefined;
  /** Per-language fields the call sent. */
  text: NoInfer<Partial<Text>>;
  /** Fields the same in every language that the call sent. */
  shared: NoInfer<Partial<Shared>>;
  /** The language's text as it stands, as far as its save needs it; undefined if it has none yet. */
  current: (language: string) => NoInfer<Partial<Text>> | undefined;
  /** What a language must be given before its first save. */
  requiredForNew: NoInfer<keyof Text & string>[];
  /** Fills in what a new language can derive, like a slug from its title. */
  completeNew?: (text: NoInfer<Partial<Text>>) => NoInfer<Partial<Text>>;
  textDto: ClassConstructor<Text>;
  sharedDto: ClassConstructor<Shared>;
  saveShared: (shared: Shared) => Promise<unknown>;
  saveText: (
    language: string,
    text: Text,
    shared: Shared | undefined,
  ) => Promise<unknown>;
}

const listed = (fields: string[]) =>
  fields.length > 1
    ? `${fields.slice(0, -1).join(", ")} and ${fields.at(-1)}`
    : (fields[0] ?? "");

/**
 * Saves what a tool call sent, merged over what is there: one language's text, the shared fields,
 * or both in one version. Shared fields belong to the default language, the way the editor has
 * them, so a call that changes them names no other language. Returns the language it saved.
 */
export async function saveContent<Text extends object, Shared extends object>(
  ctx: McpContext,
  request: SaveRequest<Text, Shared>,
): Promise<string> {
  const { site } = await ctx.context.requireSpace(request.item.spaceId);
  const language = languageOn(site, request.language);
  const textFields = Object.keys(request.text);
  const sharedFields = Object.keys(request.shared);

  if (!textFields.length && !sharedFields.length)
    throw new BadRequestException(
      "Nothing to save: send the fields to change.",
    );
  if (sharedFields.length && language !== site.defaultLanguage)
    throw new BadRequestException(
      `${listed(sharedFields)} ${sharedFields.length > 1 ? "are" : "is"} the same in every language, so ${sharedFields.length > 1 ? "they are" : "it is"} saved with the default language, "${site.defaultLanguage}". Send ${sharedFields.length > 1 ? "them" : "it"} in a separate call from the ${language} text.`,
    );

  const shared = sharedFields.length
    ? await validated(request.sharedDto, request.shared)
    : undefined;
  if (!textFields.length) {
    await request.saveShared(shared as Shared);
    return language;
  }

  const current = request.current(language);
  let text: Partial<Text> = { ...current, ...request.text };
  if (!current) {
    if (request.completeNew) text = request.completeNew(text);
    const missing = request.requiredForNew.filter((field) => !text[field]);
    if (missing.length)
      throw new BadRequestException(
        `There is no ${language} version yet, so the first save needs ${listed(missing)}.`,
      );
  }

  await request.saveText(
    language,
    await validated(request.textDto, text),
    shared,
  );
  return language;
}
