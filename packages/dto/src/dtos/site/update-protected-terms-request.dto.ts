import type { Site } from "@loom/database";
import { ArrayMaxSize, IsArray, IsNotEmpty, IsString } from "class-validator";

export class UpdateProtectedTermsRequestDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  protectedTerms: Site["protectedTerms"];
}
