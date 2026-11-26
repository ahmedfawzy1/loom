import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { LIST_MAX_PAGE_SIZE } from "../../constants/validation.constants";

export class ListMediaRequestDto {
  /** Matches filename and alt text. */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIST_MAX_PAGE_SIZE)
  pageSize?: number;

  /** Lists deleted images instead — the Trash view — rather than the library. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  deleted?: boolean;
}
