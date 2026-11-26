import {
  type CmsContentType,
  CmsRole,
  type SiteLanguage,
} from "@loom/database";
import { ContentPreviewResponseDto } from "@loom/dto";
import { Controller, Get, Param, SerializeOptions } from "@nestjs/common";
import { Roles } from "../auth/role.decorator";
import { ContentTypePipe } from "../workflow/content-type.pipe";
import { ContentPreviewService } from "./content-preview.service";

/** The admin's preview page reads from here; it needs a signed-in session, like every admin route. */
@Controller("admin/content/:type/:id/locales/:language")
export class ContentPreviewController {
  constructor(private readonly contentPreview: ContentPreviewService) {}

  // Every role edits, so every role previews — but not a Pending user, who can see no drafts at all
  @SerializeOptions({ type: ContentPreviewResponseDto })
  @Get("preview")
  @Roles(CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER)
  preview(
    @Param("type", ContentTypePipe) type: CmsContentType,
    @Param("id") id: string,
    @Param("language") language: SiteLanguage["code"],
  ): Promise<ContentPreviewResponseDto> {
    return this.contentPreview.preview(type, id, language);
  }
}
