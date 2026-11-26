import { Expose } from "class-transformer";
import { McpTokenResponseDto } from "./mcp-token-response.dto";

export class CreatedMcpTokenResponseDto extends McpTokenResponseDto {
  /** Shown once. Only its hash is stored, so it cannot be recovered — only revoked and replaced. */
  @Expose()
  token: string;
}
