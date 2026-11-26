import { Expose } from "class-transformer";
import type { PreviewableType } from "../../constants/preview.constants";

/**
 * What a Preview link points at, so the website can switch on draft mode and redirect to its own
 * page for it. Read that page with `preview=true`.
 */
export class DeliveryPreviewTargetResponseDto {
  @Expose()
  type: PreviewableType;

  @Expose()
  id: string;

  @Expose()
  languageCode: string;

  /** The latest saved slug in that language. Null for an author, whose page is found by id. */
  @Expose()
  slug: string | null;

  /** When the link stops resolving. Draft mode itself lasts as long as the website keeps it on. */
  @Expose()
  expiresAt: Date;
}
