import type { Space } from "@loom/database";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { SPACE_NAME_MAX_LENGTH } from "../../constants/validation.constants";

export class CreateSpaceRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(SPACE_NAME_MAX_LENGTH)
  name: Space["name"];

  // Omitted means start empty; set means clone that Space's content at its current state.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cloneFromSpaceId?: Space["id"];
}
