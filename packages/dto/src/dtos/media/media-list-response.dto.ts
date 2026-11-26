import { Expose, Type } from "class-transformer";
import { PaginationResponseDto } from "../content/paginated-response.dto";
import { MediaResponseDto } from "./media-response.dto";

export class MediaListResponseDto {
  @Expose()
  @Type(() => MediaResponseDto)
  items: MediaResponseDto[];

  @Expose()
  @Type(() => PaginationResponseDto)
  pagination: PaginationResponseDto;
}
