import { Module } from "@nestjs/common";
import { ActivityModule } from "../activity/activity.module";
import { TranslationModule } from "../translation/translation.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [ActivityModule, TranslationModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
