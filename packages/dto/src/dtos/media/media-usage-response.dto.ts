import { Expose } from "class-transformer";

/** One place current content uses an image — what Replace re-checks and Delete warns about. */
export class MediaUsageResponseDto {
  /** e.g. "category.featuredImage", or "blog.body" for an image embedded in a post. */
  @Expose()
  field: string;

  @Expose()
  contentId: string;

  @Expose()
  label: string;
}
