/**
 * The per-field image rules, shared by the API (which enforces them) and the
 * web picker (which greys out images that would be refused). One list, so the picker can never
 * offer an image the API then rejects.
 *
 * Rules belong to the field an image is placed in, not to the image: the same file can be a post's
 * image and a category cover.
 */

export type ImageShape = "any" | "landscape" | "square";

export interface ImageConstraint {
  shape: ImageShape;
  minWidth?: number;
  minHeight?: number;
}

export const IMAGE_FIELD_RULES = {
  "category.featuredImage": { shape: "landscape" },
  "category.featureIcon": { shape: "square" },
  "category.gameCover": { shape: "any" },
  "tag.featuredImage": { shape: "landscape", minWidth: 1200, minHeight: 630 },
  "blog.image": { shape: "any" },
  "author.profileImage": { shape: "any" },
  "cta.image": { shape: "any" },
} as const satisfies Record<string, ImageConstraint>;

export type ImageField = keyof typeof IMAGE_FIELD_RULES;

export const IMAGE_FIELD_LABELS: Record<ImageField, string> = {
  "category.featuredImage": "A category's featured image",
  "category.featureIcon": "A category's feature icon",
  "category.gameCover": "A category's game cover",
  "tag.featuredImage": "A tag's featured image",
  "blog.image": "A post's image",
  "author.profileImage": "An author's profile image",
  "cta.image": "A CTA's image",
};

/** Why an image does not fit a field, or null when it does. */
export function imageViolation(
  image: { width: number; height: number },
  constraint: ImageConstraint,
): string | null {
  const { width, height } = image;

  if (constraint.shape === "landscape" && width <= height)
    return `must be landscape (wider than tall), and this one is ${width}×${height}`;

  // Exact: an exported icon is exactly square, and a tolerance would be a rule nobody wrote down.
  if (constraint.shape === "square" && width !== height)
    return `must be square, and this one is ${width}×${height}`;

  if (
    (constraint.minWidth && width < constraint.minWidth) ||
    (constraint.minHeight && height < constraint.minHeight)
  )
    return `must be at least ${constraint.minWidth}×${constraint.minHeight}, and this one is ${width}×${height}`;

  return null;
}
