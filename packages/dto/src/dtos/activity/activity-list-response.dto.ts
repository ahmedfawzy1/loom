import { Expose, Type } from "class-transformer";
import { PaginationResponseDto } from "../content/paginated-response.dto";
import { ActivityEntryResponseDto } from "./activity-entry-response.dto";

export class ActivityListResponseDto {
  @Expose()
  @Type(() => ActivityEntryResponseDto)
  items: ActivityEntryResponseDto[];

  @Expose()
  @Type(() => PaginationResponseDto)
  pagination: PaginationResponseDto;
}
