import type { Space } from "@loom/database";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { SPACE_NAME_MAX_LENGTH } from "../../constants/validation.constants";

export class UpdateSpaceRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(SPACE_NAME_MAX_LENGTH)
  name: Space["name"];
}
