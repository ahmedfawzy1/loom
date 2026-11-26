import { BadRequestException } from "@nestjs/common";

/**
 * Normalises the text fields of a locale row before it is written.
 *
 * This lives at the write path rather than in a request DTO because the DTO is only one of its
 * writers: translation and Space cloning reach these columns without one. Blank handling has to be trim-then-nullify, not empty-string-to-null, because
 * migrated short text arrives as `" "` — which is not `""` and would collide with another
 * whitespace-only value under a unique index where two NULLs stay distinct.
 *
 * `required` names the fields that must survive trimming; anything else that trims to empty becomes
 * null, so the database sees an absent value rather than a colliding blank one.
 */
export function normaliseLocaleText<T extends Record<string, unknown>>(
  fields: T,
  required: (keyof T)[] = [],
): T {
  const normalised = { ...fields };

  for (const [key, value] of Object.entries(normalised)) {
    if (typeof value !== "string") continue;

    const trimmed = value.trim();

    if (required.includes(key as keyof T)) {
      if (!trimmed) throw new BadRequestException(`${key} cannot be blank`);
      (normalised as Record<string, unknown>)[key] = trimmed;
      continue;
    }

    (normalised as Record<string, unknown>)[key] = trimmed || null;
  }

  return normalised;
}
