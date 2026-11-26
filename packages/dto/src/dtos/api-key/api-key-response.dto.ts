import type { ApiKey } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { ContentUserResponseDto } from "../content/content-user-response.dto";

/** A key as listed: never the key itself, which exists only in the response that created it. */
export class ApiKeyResponseDto {
  @Expose()
  id: ApiKey["id"];

  @Expose()
  name: ApiKey["name"];

  /** The first characters of the key, so one can be told apart from another in the list. */
  @Expose()
  keyPrefix: ApiKey["keyPrefix"];

  @Expose()
  rateLimitPerMinute: ApiKey["rateLimitPerMinute"];

  @Expose()
  canPreview: ApiKey["canPreview"];

  @Expose()
  lastUsedAt: ApiKey["lastUsedAt"];

  @Expose()
  revokedAt: ApiKey["revokedAt"];

  @Expose()
  createdAt: ApiKey["createdAt"];

  @Expose()
  @Type(() => ContentUserResponseDto)
  createdBy: ContentUserResponseDto | null;
}
