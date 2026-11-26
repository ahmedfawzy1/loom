import { Expose, Type } from "class-transformer";
import { ContentListItemResponseDto } from "./content-list-item-response.dto";
import { PaginationResponseDto } from "./paginated-response.dto";

export class ContentListResponseDto {
  @Expose()
  @Type(() => ContentListItemResponseDto)
  items: ContentListItemResponseDto[];

  @Expose()
  @Type(() => PaginationResponseDto)
  pagination: PaginationResponseDto;
}
