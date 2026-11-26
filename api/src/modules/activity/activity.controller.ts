import { CmsRole } from "@loom/database";
import { ActivityListResponseDto, ListActivityRequestDto } from "@loom/dto";
import { Controller, Get, Query, SerializeOptions } from "@nestjs/common";
import { Roles } from "../auth/role.decorator";
import { ActivityService } from "./activity.service";

// The three roles: entries name people by email
@Controller("admin/activity")
@Roles(CmsRole.ADMIN, CmsRole.AUTHOR, CmsRole.WRITER)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @SerializeOptions({ type: ActivityListResponseDto })
  @Get()
  list(
    @Query() query: ListActivityRequestDto,
  ): Promise<ActivityListResponseDto> {
    return this.activityService.list(query);
  }
}
