import { Expose, Type } from "class-transformer";
import { DeliveryBlogSummaryResponseDto } from "./delivery-blog-summary-response.dto";

/** The list in its order, keeping only posts live in the language asked for. */
export class DeliveryFeaturedArticlesResponseDto {
  @Expose()
  @Type(() => DeliveryBlogSummaryResponseDto)
  items: DeliveryBlogSummaryResponseDto[];
}
