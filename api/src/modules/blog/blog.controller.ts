import { type Blog, CmsRole, type SiteLanguage } from "@loom/database";
import {
  BlogResponseDto,
  ContentListResponseDto,
  CreateBlogRequestDto,
  ListContentRequestDto,
  UpdateBlogLocaleRequestDto,
  UpdateBlogRequestDto,
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
import { BlogService } from "./blog.service";

const EDITORS = [CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER] as const;

@Controller("admin/blogs")
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @SerializeOptions({ type: ContentListResponseDto })
  list(@Query() query: ListContentRequestDto): Promise<ContentListResponseDto> {
    return this.blogService.list(query);
  }

  @Get(":blogId")
  @SerializeOptions({ type: BlogResponseDto })
  get(@Param("blogId") blogId: Blog["id"]): Promise<BlogResponseDto> {
    return this.blogService.get(blogId);
  }

  @Post()
  @Roles(...EDITORS)
  @SerializeOptions({ type: BlogResponseDto })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() args: CreateBlogRequestDto,
  ): Promise<BlogResponseDto> {
    return this.blogService.create(actor, args);
  }

  @Patch(":blogId")
  @Roles(...EDITORS)
  @SerializeOptions({ type: BlogResponseDto })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("blogId") blogId: Blog["id"],
    @Body() args: UpdateBlogRequestDto,
  ): Promise<BlogResponseDto> {
    return this.blogService.update(actor, blogId, args);
  }

  @Put(":blogId/locales/:language")
  @Roles(...EDITORS)
  @SerializeOptions({ type: BlogResponseDto })
  updateLocale(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("blogId") blogId: Blog["id"],
    @Param("language") language: SiteLanguage["code"],
    @Body() args: UpdateBlogLocaleRequestDto,
  ): Promise<BlogResponseDto> {
    return this.blogService.updateLocale(actor, blogId, language, args);
  }
}
