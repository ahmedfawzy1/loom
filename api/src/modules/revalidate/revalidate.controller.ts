import { CmsRole } from "@loom/database";
import { SpaceScopeRequestDto } from "@loom/dto";
import { Body, Controller, Post } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/role.decorator";
import { RevalidateService } from "./revalidate.service";

@Controller("admin/revalidate")
export class RevalidateController {
  constructor(private readonly revalidateService: RevalidateService) {}

  // Whoever can publish can refresh what publishing should already have refreshed
  @Post()
  @Roles(CmsRole.ADMIN, CmsRole.AUTHOR)
  refreshLivePages(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() args: SpaceScopeRequestDto,
  ): Promise<void> {
    return this.revalidateService.refresh(actor, args.spaceId);
  }
}
