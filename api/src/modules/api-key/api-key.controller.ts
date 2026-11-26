import { type ApiKey, CmsRole, type Site } from "@loom/database";
import {
  ApiKeyResponseDto,
  CreateApiKeyRequestDto,
  CreatedApiKeyResponseDto,
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
import { ApiKeyService } from "./api-key.service";

// Keys are Site settings, so Admin only
@Controller("admin")
@Roles(CmsRole.ADMIN)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @SerializeOptions({ type: ApiKeyResponseDto })
  @Get("sites/:siteId/api-keys")
  listApiKeys(
    @Param("siteId") siteId: Site["id"],
  ): Promise<ApiKeyResponseDto[]> {
    return this.apiKeyService.list(siteId);
  }

  @SerializeOptions({ type: CreatedApiKeyResponseDto })
  @Post("sites/:siteId/api-keys")
  createApiKey(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("siteId") siteId: Site["id"],
    @Body() args: CreateApiKeyRequestDto,
  ): Promise<CreatedApiKeyResponseDto> {
    return this.apiKeyService.create(actor, siteId, args);
  }

  @SerializeOptions({ type: ApiKeyResponseDto })
  @Post("api-keys/:apiKeyId/revoke")
  revokeApiKey(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("apiKeyId") apiKeyId: ApiKey["id"],
  ): Promise<ApiKeyResponseDto> {
    return this.apiKeyService.revoke(actor, apiKeyId);
  }
}
