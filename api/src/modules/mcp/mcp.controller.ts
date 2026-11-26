import {
  type NodeMcpRequestHandler,
  toNodeHandler,
} from "@modelcontextprotocol/node";
import {
  type AuthInfo,
  createMcpHandler,
  type McpHttpHandler,
} from "@modelcontextprotocol/server";
import {
  All,
  Controller,
  ForbiddenException,
  Logger,
  type OnModuleDestroy,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { AuthenticatedUser } from "../auth/auth.types";
import { Public } from "../auth/public.decorator";
import { MCP_AUTH_REALM, MCP_AUTH_SCHEME } from "./mcp.constants";
import { McpAuthService } from "./mcp-auth.service";
import { McpServerFactory } from "./mcp-server.factory";

function userOf(authInfo: AuthInfo | undefined): AuthenticatedUser {
  const user = authInfo?.extra?.user as AuthenticatedUser | undefined;
  // The controller authenticates before anything reaches the handler, so this is a wiring bug
  if (!user) throw new Error("An MCP request reached the server with no user");
  return user;
}

/**
 * The MCP endpoint, over Streamable HTTP: Loom's content tools for an assistant such as Claude,
 * acting as the person whose MCP token it sends. Public to SessionGuard because it authenticates
 * that token itself (see McpAuthService); every tool then checks what that person may do.
 */
@Public()
@Controller("mcp")
export class McpController implements OnModuleDestroy {
  private readonly logger = new Logger(McpController.name);
  private readonly handler: McpHttpHandler;
  private readonly serve: NodeMcpRequestHandler;

  constructor(
    private readonly auth: McpAuthService,
    servers: McpServerFactory,
  ) {
    const onerror = (error: Error) =>
      this.logger.warn(`MCP request failed: ${error.message}`);
    // One handler for the process. Each request gets a fresh server for the person it acts as.
    this.handler = createMcpHandler(
      (context) => servers.create(userOf(context.authInfo)),
      { onerror },
    );
    this.serve = toNodeHandler(this.handler, { onerror });
  }

  @All()
  async handle(@Req() request: Request, @Res() response: Response) {
    // Browsers send an Origin and MCP clients do not. Refusing every one keeps a web page from
    // driving this endpoint, which on a dev server needs no token at all.
    if (request.headers.origin)
      throw new ForbiddenException(
        "The MCP endpoint does not accept requests from browsers",
      );

    let user: AuthenticatedUser;
    try {
      user = await this.auth.authenticate(request);
    } catch (error) {
      if (error instanceof UnauthorizedException)
        response.setHeader(
          "WWW-Authenticate",
          `${MCP_AUTH_SCHEME} realm="${MCP_AUTH_REALM}"`,
        );
      throw error;
    }

    const auth: AuthInfo = {
      token: "",
      clientId: user.id,
      scopes: [],
      extra: { user },
    };
    // Nest's JSON parser has already read the body, so it is handed over rather than re-read
    await this.serve(Object.assign(request, { auth }), response, request.body);
  }

  onModuleDestroy() {
    return this.handler.close();
  }
}
