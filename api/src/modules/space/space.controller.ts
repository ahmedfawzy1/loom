import { CmsRole, type Site, type Space } from "@loom/database";
import {
  CreateSpaceRequestDto,
  DeleteSpaceRequestDto,
  SpaceResponseDto,
  UpdateSpaceRequestDto,
} from "@loom/dto";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  SerializeOptions,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/role.decorator";
import { SpaceService } from "./space.service";

@Controller("admin")
export class SpaceController {
  constructor(private readonly spaceService: SpaceService) {}

  @SerializeOptions({ type: SpaceResponseDto })
  @Get("sites/:siteId/spaces")
  listSpaces(@Param("siteId") siteId: Site["id"]): Promise<SpaceResponseDto[]> {
    return this.spaceService.listSpaces(siteId);
  }

  @SerializeOptions({ type: SpaceResponseDto })
  @Post("sites/:siteId/spaces")
  @Roles(CmsRole.ADMIN)
  createSpace(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("siteId") siteId: Site["id"],
    @Body() args: CreateSpaceRequestDto,
  ): Promise<SpaceResponseDto> {
    return this.spaceService.createSpace(
      actor,
      siteId,
      args.name,
      args.cloneFromSpaceId,
    );
  }

  @SerializeOptions({ type: SpaceResponseDto })
  @Patch("spaces/:spaceId")
  @Roles(CmsRole.ADMIN)
  renameSpace(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("spaceId") spaceId: Space["id"],
    @Body() args: UpdateSpaceRequestDto,
  ): Promise<SpaceResponseDto> {
    return this.spaceService.renameSpace(actor, spaceId, args.name);
  }

  @Delete("spaces/:spaceId")
  @Roles(CmsRole.ADMIN)
  deleteSpace(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("spaceId") spaceId: Space["id"],
    @Body() args: DeleteSpaceRequestDto,
  ) {
    return this.spaceService.deleteSpace(actor, spaceId, args.confirmName);
  }
}
