import { type Category, CmsRole, type SiteLanguage } from "@loom/database";
import {
  CategoryResponseDto,
  ContentListResponseDto,
  CreateCategoryRequestDto,
  ListContentRequestDto,
  UpdateCategoryLocaleRequestDto,
  UpdateCategoryRequestDto,
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
import { CategoryService } from "./category.service";

const EDITORS = [CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER] as const;

@Controller("admin/categories")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @SerializeOptions({ type: ContentListResponseDto })
  list(@Query() query: ListContentRequestDto): Promise<ContentListResponseDto> {
    return this.categoryService.list(query);
  }

  @Get(":categoryId")
  @SerializeOptions({ type: CategoryResponseDto })
  get(
    @Param("categoryId") categoryId: Category["id"],
  ): Promise<CategoryResponseDto> {
    return this.categoryService.get(categoryId);
  }

  @Post()
  @Roles(...EDITORS)
  @SerializeOptions({ type: CategoryResponseDto })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() args: CreateCategoryRequestDto,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.create(actor, args);
  }

  @Patch(":categoryId")
  @Roles(...EDITORS)
  @SerializeOptions({ type: CategoryResponseDto })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("categoryId") categoryId: Category["id"],
    @Body() args: UpdateCategoryRequestDto,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.update(actor, categoryId, args);
  }

  @Put(":categoryId/locales/:language")
  @Roles(...EDITORS)
  @SerializeOptions({ type: CategoryResponseDto })
  updateLocale(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("categoryId") categoryId: Category["id"],
    @Param("language") language: SiteLanguage["code"],
    @Body() args: UpdateCategoryLocaleRequestDto,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.updateLocale(actor, categoryId, language, args);
  }
}
