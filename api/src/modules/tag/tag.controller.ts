import { CmsRole, type SiteLanguage, type Tag } from "@loom/database";
import {
  ContentListResponseDto,
  CreateTagRequestDto,
  ListContentRequestDto,
  TagResponseDto,
  UpdateTagLocaleRequestDto,
  UpdateTagRequestDto,
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
import { TagService } from "./tag.service";

const EDITORS = [CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER] as const;

@Controller("admin/tags")
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @SerializeOptions({ type: ContentListResponseDto })
  list(@Query() query: ListContentRequestDto): Promise<ContentListResponseDto> {
    return this.tagService.list(query);
  }

  @Get(":tagId")
  @SerializeOptions({ type: TagResponseDto })
  get(@Param("tagId") tagId: Tag["id"]): Promise<TagResponseDto> {
    return this.tagService.get(tagId);
  }

  @Post()
  @Roles(...EDITORS)
  @SerializeOptions({ type: TagResponseDto })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() args: CreateTagRequestDto,
  ): Promise<TagResponseDto> {
    return this.tagService.create(actor, args);
  }

  @Patch(":tagId")
  @Roles(...EDITORS)
  @SerializeOptions({ type: TagResponseDto })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("tagId") tagId: Tag["id"],
    @Body() args: UpdateTagRequestDto,
  ): Promise<TagResponseDto> {
    return this.tagService.update(actor, tagId, args);
  }

  @Put(":tagId/locales/:language")
  @Roles(...EDITORS)
  @SerializeOptions({ type: TagResponseDto })
  updateLocale(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("tagId") tagId: Tag["id"],
    @Param("language") language: SiteLanguage["code"],
    @Body() args: UpdateTagLocaleRequestDto,
  ): Promise<TagResponseDto> {
    return this.tagService.updateLocale(actor, tagId, language, args);
  }
}
