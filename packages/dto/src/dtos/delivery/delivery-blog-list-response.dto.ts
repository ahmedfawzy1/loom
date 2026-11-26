import { Expose, Type } from "class-transformer";
import { PaginationResponseDto } from "../content/paginated-response.dto";
import { DeliveryBlogSummaryResponseDto } from "./delivery-blog-summary-response.dto";

export class DeliveryBlogListResponseDto extends PaginationResponseDto {
  @Expose()
  @Type(() => DeliveryBlogSummaryResponseDto)
  items: DeliveryBlogSummaryResponseDto[];
}
