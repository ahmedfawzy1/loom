import type { Author, Category, Tag } from "@loom/database";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { LIST_MAX_PAGE_SIZE } from "../../constants/validation.constants";
import { DeliveryLocaleRequestDto } from "./delivery-locale-request.dto";

export class DeliveryBlogListRequestDto extends DeliveryLocaleRequestDto {
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

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: Category["slug"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tag?: Tag["slug"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  author?: Author["id"];
}
