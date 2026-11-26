import { CmsRole, type SiteLanguage, type Space } from "@loom/database";
import {
  FeaturedArticlesResponseDto,
  UpdateFeaturedArticlesRequestDto,
} from "@loom/dto";
import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  SerializeOptions,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/role.decorator";
import { FeaturedArticlesService } from "./featured-articles.service";

const EDITORS = [CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER] as const;

// One list per Space rather than a collection, so it is addressed by Space
@Controller("admin/spaces/:spaceId/featured-articles")
export class FeaturedArticlesController {
  constructor(
    private readonly featuredArticlesService: FeaturedArticlesService,
  ) {}

  @Get()
  @SerializeOptions({ type: FeaturedArticlesResponseDto })
  get(
    @Param("spaceId") spaceId: Space["id"],
  ): Promise<FeaturedArticlesResponseDto> {
    return this.featuredArticlesService.get(spaceId);
  }

  @Put("locales/:language")
  @Roles(...EDITORS)
  @SerializeOptions({ type: FeaturedArticlesResponseDto })
  updateLocale(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("spaceId") spaceId: Space["id"],
    @Param("language") language: SiteLanguage["code"],
    @Body() args: UpdateFeaturedArticlesRequestDto,
  ): Promise<FeaturedArticlesResponseDto> {
    return this.featuredArticlesService.updateLocale(
      actor,
      spaceId,
      language,
      args,
    );
  }
}
