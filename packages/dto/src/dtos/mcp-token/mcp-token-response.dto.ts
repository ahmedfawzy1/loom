import type { McpToken } from "@loom/database";
import { Expose } from "class-transformer";

/** A token as listed: never the token itself, which exists only in the response that created it. */
export class McpTokenResponseDto {
  @Expose()
  id: McpToken["id"];

  @Expose()
  name: McpToken["name"];

  /** The first characters of the token, so one can be told apart from another in the list. */
  @Expose()
  tokenPrefix: McpToken["tokenPrefix"];

  @Expose()
  lastUsedAt: McpToken["lastUsedAt"];

  /** It stops working after this, even if nobody revokes it. */
  @Expose()
  expiresAt: McpToken["expiresAt"];

  @Expose()
  revokedAt: McpToken["revokedAt"];

  @Expose()
  createdAt: McpToken["createdAt"];
}
