import { Expose, Type } from "class-transformer";
import { ActivityEntryResponseDto } from "../activity/activity-entry-response.dto";
import { TranslationUsageResponseDto } from "../translation/translation-usage-response.dto";
import { DashboardMissingCountResponseDto } from "./dashboard-missing-count-response.dto";
import { DashboardStatusCountResponseDto } from "./dashboard-status-count-response.dto";
import { DashboardTranslationGapResponseDto } from "./dashboard-translation-gap-response.dto";

/** The CMS home. The review queue has its own endpoint and is shown beside this. */
export class DashboardResponseDto {
  /** Every item in the language worked in, by type and status; those with no version are `missing`. */
  @Expose()
  @Type(() => DashboardStatusCountResponseDto)
  statusCounts: DashboardStatusCountResponseDto[];

  /** Items with no version in the language worked in, by type. */
  @Expose()
  @Type(() => DashboardMissingCountResponseDto)
  missing: DashboardMissingCountResponseDto[];

  @Expose()
  @Type(() => DashboardTranslationGapResponseDto)
  translations: DashboardTranslationGapResponseDto[];

  @Expose()
  @Type(() => ActivityEntryResponseDto)
  recentEdits: ActivityEntryResponseDto[];

  @Expose()
  @Type(() => TranslationUsageResponseDto)
  deeplUsage: TranslationUsageResponseDto;
}
