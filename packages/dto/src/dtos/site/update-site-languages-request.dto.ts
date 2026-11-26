import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, ValidateNested } from "class-validator";
import { UpdateSiteLanguageRequestDto } from "./update-site-language-request.dto";

export class UpdateSiteLanguagesRequestDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => UpdateSiteLanguageRequestDto)
  languages: UpdateSiteLanguageRequestDto[];
}
