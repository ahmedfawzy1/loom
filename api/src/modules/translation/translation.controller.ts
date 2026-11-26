import {
  type CmsContentType,
  CmsRole,
  type Site,
  type SiteLanguage,
} from "@loom/database";
import {
  TranslateRequestDto,
  TranslationFieldsResponseDto,
  TranslationResultResponseDto,
  TranslationUsageResponseDto,
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
import type { CanonicalRow } from "../content/content-item.util";
import { ContentTypePipe } from "../workflow/content-type.pipe";
import { TranslationService } from "./translation.service";

const EDITORS = [CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER] as const;

@Controller("admin")
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Post("content/:type/:id/translate")
  @Roles(...EDITORS)
  @SerializeOptions({ type: TranslationResultResponseDto })
  translate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
    @Body() args: TranslateRequestDto,
  ): Promise<TranslationResultResponseDto[]> {
    return this.translationService.translate(actor, type, id, args);
  }

  /** Every role: confirming a hand translation is part of translating it. */
  @Post("content/:type/:id/locales/:language/mark-current")
  @Roles(...EDITORS)
  markCurrent(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
    @Param("language") language: SiteLanguage["code"],
  ): Promise<void> {
    return this.translationService.markCurrent(actor, type, id, language);
  }

  /** Which fields of each translation are behind the source — read-only, so any role. */
  @Get("content/:type/:id/translation-fields")
  @SerializeOptions({ type: TranslationFieldsResponseDto })
  fieldStates(
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: CanonicalRow["id"],
  ): Promise<TranslationFieldsResponseDto[]> {
    return this.translationService.fieldStates(type, id);
  }

  @Get("sites/:siteId/translation-usage")
  @SerializeOptions({ type: TranslationUsageResponseDto })
  usage(
    @Param("siteId") siteId: Site["id"],
  ): Promise<TranslationUsageResponseDto> {
    return this.translationService.usage(siteId);
  }
}
