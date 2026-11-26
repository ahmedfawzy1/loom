import { Expose } from "class-transformer";

export class PaginationResponseDto {
  @Expose()
  page: number;

  @Expose()
  pageSize: number;

  @Expose()
  total: number;

  @Expose()
  totalPages: number;
}
