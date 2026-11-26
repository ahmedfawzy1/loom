import type { BlogLocale } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { DeliveryAlternateResponseDto } from "./delivery-alternate-response.dto";
import { DeliveryAuthorResponseDto } from "./delivery-author-response.dto";
import { DeliveryBlogSummaryResponseDto } from "./delivery-blog-summary-response.dto";
import { DeliveryFaqItemResponseDto } from "./delivery-faq-item-response.dto";
import { DeliveryIncludesResponseDto } from "./delivery-includes-response.dto";
import { DeliveryTagResponseDto } from "./delivery-tag-response.dto";

export class DeliveryBlogResponseDto extends DeliveryBlogSummaryResponseDto {
  @Expose()
  summary: BlogLocale["summary"];

  @Expose()
  updateNote: BlogLocale["updateNote"];

  /** The Tiptap document as stored; its references are resolved in `includes`. */
  @Expose()
  body: Record<string, unknown>;

  @Expose()
  @Type(() => DeliveryFaqItemResponseDto)
  faq: DeliveryFaqItemResponseDto[];

  @Expose()
  @Type(() => DeliveryAuthorResponseDto)
  reviewer: DeliveryAuthorResponseDto | null;

  @Expose()
  @Type(() => DeliveryTagResponseDto)
  tags: DeliveryTagResponseDto[];

  @Expose()
  @Type(() => DeliveryAlternateResponseDto)
  alternates: DeliveryAlternateResponseDto[];

  @Expose()
  @Type(() => DeliveryIncludesResponseDto)
  includes: DeliveryIncludesResponseDto;
}
