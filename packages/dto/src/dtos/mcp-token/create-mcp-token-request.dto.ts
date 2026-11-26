import type { McpToken } from "@loom/database";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { MCP_TOKEN_NAME_MAX_LENGTH } from "../../constants/validation.constants";

export class CreateMcpTokenRequestDto {
  /** Where the token will be used, so it can be found and revoked later: "Claude on my laptop". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(MCP_TOKEN_NAME_MAX_LENGTH)
  name: McpToken["name"];
}
