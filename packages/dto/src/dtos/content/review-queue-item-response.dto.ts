import type { BlogLocale } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { ContentItemResponseDto } from "./content-item-response.dto";
import { ContentUserResponseDto } from "./content-user-response.dto";

/** One locale waiting on a reviewer, or — for a Writer — one of their own submissions. */
export class ReviewQueueItemResponseDto extends ContentItemResponseDto {
  @Expose()
  title: string;

  @Expose()
  languageCode: BlogLocale["languageCode"];

  @Expose()
  status: BlogLocale["status"];

  @Expose()
  submittedAt: BlogLocale["submittedAt"];

  @Expose()
  @Type(() => ContentUserResponseDto)
  submittedBy: ContentUserResponseDto | null;

  @Expose()
  reviewNote: BlogLocale["reviewNote"];
}
