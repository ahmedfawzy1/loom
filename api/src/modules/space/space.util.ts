import type { Space } from "@loom/database";

/** Spaces are named freely, so the URL-safe slug is derived rather than asked for. */
export const slugifySpaceName = (name: Space["name"]): Space["slug"] =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "space";
