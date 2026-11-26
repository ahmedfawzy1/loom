import type { CmsContentType, Prisma, SiteLanguage } from "@loom/database";
import {
  type CanonicalRow,
  localeDelegate,
  versionDelegate,
} from "./content-item.util";
import { contentKind } from "./content-kind.registry";

/** The part of a snapshot every canonical-bearing type shares: its shared fields. */
interface WithCanonical<TCanonical> {
  canonical: TCanonical;
}

/**
 * The served-shared-fields rule: the default language's live shared fields when it has any, the locale's own otherwise.
 * `liveCanonical` applies it to one locale, the Content API to a batch.
 */
export const servedCanonical = <TCanonical>(
  own: TCanonical,
  defaultLive: TCanonical | undefined,
): TCanonical => defaultLive ?? own;

/**
 * The shared fields the website serves with a locale: the default language's published
 * snapshot, for every language, so a slug or a byline never differs between languages on the site.
 * A translation published while the default language never has been falls back to its own.
 *
 * The one statement of that rule — the publish gate checks what this returns, and the Content API
 * serves it through `servedCanonical` — so what is checked and what is served cannot drift apart.
 */
export async function liveCanonical<TCanonical>(
  tx: Prisma.TransactionClient,
  type: CmsContentType,
  itemId: CanonicalRow["id"],
  languageCode: SiteLanguage["code"],
  defaultLanguage: SiteLanguage["code"],
  own: WithCanonical<TCanonical>,
): Promise<TCanonical> {
  if (languageCode === defaultLanguage) return own.canonical;

  const kind = contentKind(type);
  const source = await localeDelegate(tx, type).findFirst({
    where: { [kind.localeForeignKey]: itemId, languageCode: defaultLanguage },
  });
  if (source?.publishedRevision == null) return own.canonical;

  const version = await versionDelegate(tx, type).findFirst({
    where: {
      [kind.versionForeignKey]: source.id,
      revision: source.publishedRevision,
    },
  });
  const served = version?.snapshot as Partial<WithCanonical<TCanonical>> | null;
  return servedCanonical(own.canonical, served?.canonical);
}
