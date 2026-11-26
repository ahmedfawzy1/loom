import type { Site } from "@loom/database";
import { IsNotEmpty, IsString } from "class-validator";

// Deleting a Site removes every Space and everything in them, so the Admin retypes its name
export class DeleteSiteRequestDto {
  @IsString()
  @IsNotEmpty()
  confirmName: Site["name"];
}
