import type { CmsUser } from "@loom/database";
import { CmsRole } from "@loom/database";
import {
  CmsUserResponseDto,
  ContentUserResponseDto,
  InvitedUserResponseDto,
  InviteUserRequestDto,
  PasswordLinkResponseDto,
  UpdateUserRoleRequestDto,
  UpdateUserStatusRequestDto,
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
import { UserService } from "./user.service";

@Controller("admin/users")
@Roles(CmsRole.ADMIN)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @SerializeOptions({ type: CmsUserResponseDto })
  @Get()
  listUsers(): Promise<CmsUserResponseDto[]> {
    return this.userService.listUsers();
  }

  /**
   * Who is who, for the filters every role's screens have — submitted by, the Activity log. Names
   * and emails only; roles and statuses stay on the Admin's Users screen.
   */
  @SerializeOptions({ type: ContentUserResponseDto })
  @Get("directory")
  @Roles(CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER)
  directory(): Promise<ContentUserResponseDto[]> {
    return this.userService.directory();
  }

  @SerializeOptions({ type: InvitedUserResponseDto })
  @Post()
  invite(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() args: InviteUserRequestDto,
  ): Promise<InvitedUserResponseDto> {
    return this.userService.invite(actor, args);
  }

  @SerializeOptions({ type: PasswordLinkResponseDto })
  @Post(":userId/password-link")
  createPasswordLink(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("userId") userId: CmsUser["id"],
  ): Promise<PasswordLinkResponseDto> {
    return this.userService.createPasswordLink(actor, userId);
  }

  @SerializeOptions({ type: CmsUserResponseDto })
  @Patch(":userId/role")
  updateRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("userId") userId: CmsUser["id"],
    @Body() args: UpdateUserRoleRequestDto,
  ): Promise<CmsUserResponseDto> {
    return this.userService.updateRole(actor, userId, args.role);
  }

  @SerializeOptions({ type: CmsUserResponseDto })
  @Patch(":userId/status")
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("userId") userId: CmsUser["id"],
    @Body() args: UpdateUserStatusRequestDto,
  ): Promise<CmsUserResponseDto> {
    return this.userService.updateStatus(actor, userId, args.status);
  }

  @Delete(":userId")
  deleteUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("userId") userId: CmsUser["id"],
  ) {
    return this.userService.deleteUser(actor, userId);
  }
}
