import { type Author, CmsRole, type SiteLanguage } from "@loom/database";
import {
  AuthorResponseDto,
  ContentListResponseDto,
  CreateAuthorRequestDto,
  ListContentRequestDto,
  UpdateAuthorLocaleRequestDto,
  UpdateAuthorRequestDto,
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
import { AuthorService } from "./author.service";

const EDITORS = [CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER] as const;

@Controller("admin/authors")
export class AuthorController {
  constructor(private readonly authorService: AuthorService) {}

  @Get()
  @SerializeOptions({ type: ContentListResponseDto })
  list(@Query() query: ListContentRequestDto): Promise<ContentListResponseDto> {
    return this.authorService.list(query);
  }

  @Get(":authorId")
  @SerializeOptions({ type: AuthorResponseDto })
  get(@Param("authorId") authorId: Author["id"]): Promise<AuthorResponseDto> {
    return this.authorService.get(authorId);
  }

  @Post()
  @Roles(...EDITORS)
  @SerializeOptions({ type: AuthorResponseDto })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() args: CreateAuthorRequestDto,
  ): Promise<AuthorResponseDto> {
    return this.authorService.create(actor, args);
  }

  @Patch(":authorId")
  @Roles(...EDITORS)
  @SerializeOptions({ type: AuthorResponseDto })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("authorId") authorId: Author["id"],
    @Body() args: UpdateAuthorRequestDto,
  ): Promise<AuthorResponseDto> {
    return this.authorService.update(actor, authorId, args);
  }

  @Put(":authorId/locales/:language")
  @Roles(...EDITORS)
  @SerializeOptions({ type: AuthorResponseDto })
  updateLocale(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("authorId") authorId: Author["id"],
    @Param("language") language: SiteLanguage["code"],
    @Body() args: UpdateAuthorLocaleRequestDto,
  ): Promise<AuthorResponseDto> {
    return this.authorService.updateLocale(actor, authorId, language, args);
  }
}
