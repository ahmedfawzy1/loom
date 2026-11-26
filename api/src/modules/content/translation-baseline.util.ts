import type { TranslatedField } from "./content-kind.registry";
import { parseDocument } from "./rich-text.util";
import { fingerprint } from "./stable-json.util";

/**
 * Per translated field: a fingerprint of the source text it was made from, and of the text the
 * machine wrote — null when a person wrote it. A field whose text no longer matches `target` has
 * been edited by hand since, and a translate leaves it alone.
 */
export interface BaselineEntry {
  source: string;
  target: string | null;
}
export type Baseline = Record<string, BaselineEntry>;

interface FaqItem {
  question: string;
  answer: string;
}

// A bare fingerprint predates target tracking: nothing says the machine wrote it, so it counts as a person's
export const entryOf = (entry: unknown): BaselineEntry | undefined =>
  typeof entry === "string"
    ? { source: entry, target: null }
    : (entry as BaselineEntry | undefined);

/**
 * A fingerprint of a language's own text, taken the same way whether it was just translated or read
 * back after the save normalised it. A body counts whole — links, marks, embeds, heading levels — so
 * a translator re-pointing a link is a hand edit too.
 */
export function targetPrint(
  kind: TranslatedField["kind"],
  value: unknown,
): string {
  if (kind === "richText") {
    if (!value) return fingerprint(null);
    try {
      return fingerprint(parseDocument(value));
    } catch {
      // A stored body the schema no longer accepts is compared as it stands
      return fingerprint(value);
    }
  }
  if (kind === "faq")
    return fingerprint(
      ((value ?? []) as FaqItem[]).map((item) => [
        (item.question ?? "").trim(),
        (item.answer ?? "").trim(),
      ]),
    );
  return fingerprint(
    typeof value === "string" ? value.trim() || null : (value ?? null),
  );
}

/**
 * A baseline after a body was rewritten by the system rather than a person — a Space clone pointing
 * embeds at its own copies. A body the machine owned before stays the machine's.
 */
export function retargetBody(
  baseline: unknown,
  before: unknown,
  after: unknown,
): unknown {
  const entry = entryOf((baseline as Record<string, unknown> | null)?.body);
  if (!entry?.target || entry.target !== targetPrint("richText", before))
    return baseline;
  return {
    ...(baseline as Record<string, unknown>),
    body: { ...entry, target: targetPrint("richText", after) },
  };
}
