import { Expose } from "class-transformer";
import { ApiKeyResponseDto } from "./api-key-response.dto";

export class CreatedApiKeyResponseDto extends ApiKeyResponseDto {
  /** Shown once. Only its hash is stored, so it cannot be recovered — only revoked and replaced. */
  @Expose()
  key: string;
}
