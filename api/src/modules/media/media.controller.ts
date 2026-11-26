import { CmsRole, type Media } from "@loom/database";
import {
  ConfirmMediaRequestDto,
  CreateMediaUploadRequestDto,
  ListMediaRequestDto,
  MediaListResponseDto,
  MediaResponseDto,
  MediaUploadResponseDto,
  MediaUsageResponseDto,
  ReplaceMediaRequestDto,
  UpdateMediaRequestDto,
} from "@loom/dto";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  SerializeOptions,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/role.decorator";
import { MediaService } from "./media.service";

// Every role can upload and replace; only Admin and Author can delete
const UPLOADERS = [CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER] as const;
const DELETERS = [CmsRole.ADMIN, CmsRole.AUTHOR] as const;

@Controller("admin/media")
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @SerializeOptions({ type: MediaListResponseDto })
  list(@Query() query: ListMediaRequestDto): Promise<MediaListResponseDto> {
    return this.mediaService.list(query);
  }

  /** Step one of an upload: a signed POST policy the browser sends the file through directly. */
  @Post("uploads")
  @Roles(...UPLOADERS)
  @SerializeOptions({ type: MediaUploadResponseDto })
  createUpload(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() args: CreateMediaUploadRequestDto,
  ): Promise<MediaUploadResponseDto> {
    return this.mediaService.createUpload(actor, args);
  }

  /** Step two: the API measures what landed and records it. */
  @Post()
  @Roles(...UPLOADERS)
  @SerializeOptions({ type: MediaResponseDto })
  confirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() args: ConfirmMediaRequestDto,
  ): Promise<MediaResponseDto> {
    return this.mediaService.confirm(actor, args);
  }

  @Get(":mediaId")
  @SerializeOptions({ type: MediaResponseDto })
  get(@Param("mediaId") mediaId: Media["id"]): Promise<MediaResponseDto> {
    return this.mediaService.get(mediaId);
  }

  @Get(":mediaId/usages")
  @SerializeOptions({ type: MediaUsageResponseDto })
  usages(
    @Param("mediaId") mediaId: Media["id"],
  ): Promise<MediaUsageResponseDto[]> {
    return this.mediaService.usagesOf(mediaId);
  }

  @Patch(":mediaId")
  @Roles(...UPLOADERS)
  @SerializeOptions({ type: MediaResponseDto })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("mediaId") mediaId: Media["id"],
    @Body() args: UpdateMediaRequestDto,
  ): Promise<MediaResponseDto> {
    return this.mediaService.update(actor, mediaId, args);
  }

  @Post(":mediaId/replace")
  @Roles(...UPLOADERS)
  @SerializeOptions({ type: MediaResponseDto })
  replace(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("mediaId") mediaId: Media["id"],
    @Body() args: ReplaceMediaRequestDto,
  ): Promise<MediaResponseDto> {
    return this.mediaService.replace(actor, mediaId, args.key);
  }

  @Post(":mediaId/restore")
  @Roles(...DELETERS)
  restore(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("mediaId") mediaId: Media["id"],
  ) {
    return this.mediaService.restore(actor, mediaId);
  }

  @Delete(":mediaId")
  @Roles(...DELETERS)
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("mediaId") mediaId: Media["id"],
  ) {
    return this.mediaService.remove(actor, mediaId);
  }
}
