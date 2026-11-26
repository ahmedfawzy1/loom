import type { Space } from "@loom/database";
import { IsNotEmpty, IsString } from "class-validator";

/** Scopes a cross-type listing — the review queue, the Trash — to one Space. */
export class SpaceScopeRequestDto {
  @IsString()
  @IsNotEmpty()
  spaceId: Space["id"];
}
