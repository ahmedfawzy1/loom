import type { Space } from "@loom/database";
import { IsNotEmpty, IsString } from "class-validator";

// Deletion is permanent, so the Admin retypes the Space name.
export class DeleteSpaceRequestDto {
  @IsString()
  @IsNotEmpty()
  confirmName: Space["name"];
}
