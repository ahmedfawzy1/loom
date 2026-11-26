import type { PendingUpload } from "@loom/database";
import { IsNotEmpty, IsString } from "class-validator";

/** Points an existing Media row at a newly uploaded object, keeping its id and every reference. */
export class ReplaceMediaRequestDto {
  @IsString()
  @IsNotEmpty()
  key: PendingUpload["key"];
}
