import type { Site } from "@loom/database";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class UpdateSiteRequestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: Site["name"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  domain?: Site["domain"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  defaultLanguage?: Site["defaultLanguage"];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  // require_tld off so http://localhost:3000 is accepted — that is the dev revalidate target
  @IsUrl({ require_tld: false })
  revalidateUrl?: Site["revalidateUrl"];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  revalidateSecret?: NonNullable<Site["revalidateSecret"]>;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  // require_tld off so http://localhost:3000/api/preview works in development
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  previewUrl?: Site["previewUrl"];
}
