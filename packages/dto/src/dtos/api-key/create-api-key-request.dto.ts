import type { ApiKey } from "@loom/database";
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_RATE_LIMIT_MAX,
} from "../../constants/validation.constants";

export class CreateApiKeyRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(API_KEY_NAME_MAX_LENGTH)
  name: ApiKey["name"];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(API_KEY_RATE_LIMIT_MAX)
  rateLimitPerMinute?: ApiKey["rateLimitPerMinute"];

  /** Whether the key may read drafts with `preview=true`. Fixed once the key exists. */
  @IsOptional()
  @IsBoolean()
  canPreview?: ApiKey["canPreview"];
}
