import type { CmsContentType } from "@loom/database";
import { CONTENT_TYPE_LABELS } from "@loom/dto/constants";
import { contentKind } from "./content-kind.registry";

/**
 * How an item is named in a list that mixes every type. Most types are named by a locale column;
 * an Author by its canonical name; a Featured Articles list by nothing but what it is.
 */
export function contentTitle(
  type: CmsContentType,
  canonical: Record<string, unknown>,
  locale: Record<string, unknown> | undefined,
): string {
  const kind = contentKind(type);
  const title = kind.canonicalTitleField
    ? canonical[kind.canonicalTitleField]
    : locale?.[kind.titleField];
  return typeof title === "string" && kind.titleField !== "languageCode"
    ? title
    : CONTENT_TYPE_LABELS[type];
}
