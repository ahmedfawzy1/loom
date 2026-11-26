import {
  type CmsContentType,
  CmsRole,
  type SiteLanguage,
} from "@loom/database";
import { PreviewLinkResponseDto } from "@loom/dto";
import { Controller, Param, Post, SerializeOptions } from "@nestjs/common";
import { Roles } from "../auth/role.decorator";
import { ContentTypePipe } from "../workflow/content-type.pipe";
import { PreviewService } from "./preview.service";

@Controller("admin/content/:type/:id/locales/:language")
export class PreviewController {
  constructor(private readonly previewService: PreviewService) {}

  // Every role edits, so every role previews — but not a Pending user, who can see no drafts at all
  @SerializeOptions({ type: PreviewLinkResponseDto })
  @Post("preview-link")
  @Roles(CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER)
  createLink(
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: string,
    @Param("language") language: SiteLanguage["code"],
  ): Promise<PreviewLinkResponseDto> {
    return this.previewService.createLink(type, id, language);
  }
}
