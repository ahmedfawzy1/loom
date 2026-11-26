import type { SiteLanguage, Space } from "@loom/database";
import { IsNotEmpty, IsString } from "class-validator";

export class DashboardRequestDto {
  @IsString()
  @IsNotEmpty()
  spaceId: Space["id"];

  /** The language worked in: the status counts are for it. */
  @IsString()
  @IsNotEmpty()
  language: SiteLanguage["code"];
}
