import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedUser } from "../auth/auth.types";
import { MCP_TOKEN_PREFIX } from "../mcp-token/mcp-token.constants";
import { McpTokenService } from "../mcp-token/mcp-token.service";
import { MCP_AUTH_SCHEME } from "./mcp.constants";

/**
 * Who an MCP request acts as. /mcp is public to the session guard, the way the Content API is,
 * because an assistant cannot sign in with a password: the request names its person with an MCP
 * token instead, in every environment.
 */
@Injectable()
export class McpAuthService {
  constructor(private readonly tokens: McpTokenService) {}

  async authenticate(request: Request): Promise<AuthenticatedUser> {
    const header = request.headers.authorization;
    if (!header)
      throw new UnauthorizedException(
        `Send an MCP token as "Authorization: ${MCP_AUTH_SCHEME} ${MCP_TOKEN_PREFIX}…". Make one in Loom, under Settings → MCP.`,
      );

    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== MCP_AUTH_SCHEME.toLowerCase() || !token)
      throw new UnauthorizedException(
        `Send the MCP token as "Authorization: ${MCP_AUTH_SCHEME} <token>"`,
      );
    return this.tokens.authenticate(token);
  }
}
