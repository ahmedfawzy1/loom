import { CmsRole, type McpToken } from "@loom/database";
import {
  CreatedMcpTokenResponseDto,
  CreateMcpTokenRequestDto,
  McpTokenResponseDto,
} from "@loom/dto";
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  SerializeOptions,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/role.decorator";
import { McpTokenService } from "./mcp-token.service";

// Every role, since a token can only do what its owner's role can
@Controller("admin/mcp-tokens")
@Roles(CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER)
export class McpTokenController {
  constructor(private readonly mcpTokenService: McpTokenService) {}

  @SerializeOptions({ type: McpTokenResponseDto })
  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<McpTokenResponseDto[]> {
    return this.mcpTokenService.list(actor);
  }

  @SerializeOptions({ type: CreatedMcpTokenResponseDto })
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() args: CreateMcpTokenRequestDto,
  ): Promise<CreatedMcpTokenResponseDto> {
    return this.mcpTokenService.create(actor, args);
  }

  @SerializeOptions({ type: McpTokenResponseDto })
  @Post(":tokenId/revoke")
  revoke(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("tokenId") tokenId: McpToken["id"],
  ): Promise<McpTokenResponseDto> {
    return this.mcpTokenService.revoke(actor, tokenId);
  }
}
