import type {
  CmsContentType,
  PrismaClient,
  SiteLanguage,
} from "@loom/database";
import { canonicalDelegate } from "./content-item.util";
import { contentKind } from "./content-kind.registry";
import { contentTitle } from "./content-title.util";

/** One item among many of different types. */
export interface ContentRef {
  type: CmsContentType;
  id: string;
}

export const refKey = (ref: ContentRef) => `${ref.type}:${ref.id}`;

/**
 * What to call each of a mixed batch of items — the Activity log, the dashboard's recent edits —
 * in `language`, falling back to its own Site's default language and then to any it has. One query
 * per type. An item deleted for good is absent from the result.
 */
export async function contentTitles(
  client: PrismaClient,
  refs: ContentRef[],
  language: SiteLanguage["code"],
): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  const byType = new Map<CmsContentType, Set<string>>();
  for (const ref of refs)
    byType.set(ref.type, (byType.get(ref.type) ?? new Set()).add(ref.id));

  await Promise.all(
    [...byType].map(async ([type, ids]) => {
      // The title column only: a post's locales also hold its body, in every language
      const rows = (await canonicalDelegate(client, type).findMany({
        where: { id: { in: [...ids] } },
        include: {
          locales: {
            select: {
              languageCode: true,
              [contentKind(type).titleField]: true,
            },
          },
          space: { select: { site: { select: { defaultLanguage: true } } } },
        },
      })) as unknown as (Record<string, unknown> & {
        id: string;
        locales: Record<string, unknown>[];
        space: { site: { defaultLanguage: SiteLanguage["code"] } };
      })[];
      for (const row of rows) {
        const locale =
          row.locales.find((l) => l.languageCode === language) ??
          row.locales.find(
            (l) => l.languageCode === row.space.site.defaultLanguage,
          ) ??
          row.locales[0];
        titles.set(
          refKey({ type, id: row.id }),
          contentTitle(type, row, locale),
        );
      }
    }),
  );
  return titles;
}
