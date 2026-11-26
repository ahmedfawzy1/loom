import { createHash } from "node:crypto";

/**
 * JSON with object keys sorted at every depth, so two equal values always serialise the same. A
 * snapshot read back from Postgres has its keys reordered by `jsonb`, so comparing it with a fresh
 * one through plain `JSON.stringify` reports a change where there is none.
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

/**
 * A short, stable fingerprint of a value — what a translation's baseline records per field, so it can
 * tell later whether the source text it was made from has changed without keeping that text.
 */
export const fingerprint = (value: unknown): string =>
  createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")
    .slice(0, 16);
