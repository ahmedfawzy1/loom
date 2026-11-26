import { DashboardRequestDto, DashboardResponseDto } from "@loom/dto";
import { Controller, Get, Query, SerializeOptions } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";

// Every role sees the dashboard: it only reads
@Controller("admin/dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @SerializeOptions({ type: DashboardResponseDto })
  @Get()
  get(@Query() query: DashboardRequestDto): Promise<DashboardResponseDto> {
    return this.dashboardService.get(query);
  }
}
