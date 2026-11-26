import { CmsRole, type Cta, type SiteLanguage } from "@loom/database";
import {
  ContentListResponseDto,
  CreateCtaRequestDto,
  CtaResponseDto,
  ListContentRequestDto,
  UpdateCtaLocaleRequestDto,
  UpdateCtaRequestDto,
} from "@loom/dto";
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  SerializeOptions,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/role.decorator";
import { CtaService } from "./cta.service";

const EDITORS = [CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER] as const;

@Controller("admin/ctas")
export class CtaController {
  constructor(private readonly ctaService: CtaService) {}

  @Get()
  @SerializeOptions({ type: ContentListResponseDto })
  list(@Query() query: ListContentRequestDto): Promise<ContentListResponseDto> {
    return this.ctaService.list(query);
  }

  @Get(":ctaId")
  @SerializeOptions({ type: CtaResponseDto })
  get(@Param("ctaId") ctaId: Cta["id"]): Promise<CtaResponseDto> {
    return this.ctaService.get(ctaId);
  }

  @Post()
  @Roles(...EDITORS)
  @SerializeOptions({ type: CtaResponseDto })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() args: CreateCtaRequestDto,
  ): Promise<CtaResponseDto> {
    return this.ctaService.create(actor, args);
  }

  @Patch(":ctaId")
  @Roles(...EDITORS)
  @SerializeOptions({ type: CtaResponseDto })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("ctaId") ctaId: Cta["id"],
    @Body() args: UpdateCtaRequestDto,
  ): Promise<CtaResponseDto> {
    return this.ctaService.update(actor, ctaId, args);
  }

  @Put(":ctaId/locales/:language")
  @Roles(...EDITORS)
  @SerializeOptions({ type: CtaResponseDto })
  updateLocale(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("ctaId") ctaId: Cta["id"],
    @Param("language") language: SiteLanguage["code"],
    @Body() args: UpdateCtaLocaleRequestDto,
  ): Promise<CtaResponseDto> {
    return this.ctaService.updateLocale(actor, ctaId, language, args);
  }
}
