import { CmsRole, type Site } from "@loom/database";
import {
  CreateSiteRequestDto,
  DeleteSiteRequestDto,
  SiteResponseDto,
  UpdateProtectedTermsRequestDto,
  UpdateSiteLanguagesRequestDto,
  UpdateSiteRequestDto,
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
import { SiteService } from "./site.service";

@Controller("admin/sites")
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  // Every role needs to know which Sites, Spaces and languages exist to work at all
  @SerializeOptions({ type: SiteResponseDto })
  @Get()
  listSites(): Promise<SiteResponseDto[]> {
    return this.siteService.listSites();
  }

  @SerializeOptions({ type: SiteResponseDto })
  @Get(":siteId")
  getSite(@Param("siteId") siteId: Site["id"]): Promise<SiteResponseDto> {
    return this.siteService.getSite(siteId);
  }

  @SerializeOptions({ type: SiteResponseDto })
  @Post()
  @Roles(CmsRole.ADMIN)
  createSite(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() args: CreateSiteRequestDto,
  ): Promise<SiteResponseDto> {
    return this.siteService.createSite(actor, args);
  }

  @SerializeOptions({ type: SiteResponseDto })
  @Patch(":siteId")
  @Roles(CmsRole.ADMIN)
  updateSite(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("siteId") siteId: Site["id"],
    @Body() args: UpdateSiteRequestDto,
  ): Promise<SiteResponseDto> {
    return this.siteService.updateSite(actor, siteId, args);
  }

  @Delete(":siteId")
  @Roles(CmsRole.ADMIN)
  deleteSite(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("siteId") siteId: Site["id"],
    @Body() args: DeleteSiteRequestDto,
  ) {
    return this.siteService.deleteSite(actor, siteId, args.confirmName);
  }

  @SerializeOptions({ type: SiteResponseDto })
  @Patch(":siteId/protected-terms")
  @Roles(CmsRole.ADMIN)
  updateProtectedTerms(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("siteId") siteId: Site["id"],
    @Body() args: UpdateProtectedTermsRequestDto,
  ): Promise<SiteResponseDto> {
    return this.siteService.updateProtectedTerms(
      actor,
      siteId,
      args.protectedTerms,
    );
  }

  @SerializeOptions({ type: SiteResponseDto })
  @Patch(":siteId/languages")
  @Roles(CmsRole.ADMIN)
  updateLanguages(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("siteId") siteId: Site["id"],
    @Body() args: UpdateSiteLanguagesRequestDto,
  ): Promise<SiteResponseDto> {
    return this.siteService.updateLanguages(actor, siteId, args.languages);
  }
}
