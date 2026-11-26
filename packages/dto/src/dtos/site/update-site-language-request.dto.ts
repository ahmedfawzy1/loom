import type { SiteLanguage } from "@loom/database";
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class UpdateSiteLanguageRequestDto {
  @IsString()
  @IsNotEmpty()
  code: SiteLanguage["code"];

  @IsOptional()
  @IsBoolean()
  enabled?: SiteLanguage["enabled"];

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: SiteLanguage["position"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  deeplCode?: NonNullable<SiteLanguage["deeplCode"]>;
}
