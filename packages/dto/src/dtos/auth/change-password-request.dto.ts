import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../../constants/validation.constants";

/** A signed-in person replacing their own password, which they must know to do it. */
export class ChangePasswordRequestDto {
  // No minimum: it only has to match, and it may predate the current one
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Choose a password of at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `Choose a password of at most ${PASSWORD_MAX_LENGTH} characters`,
  })
  newPassword: string;
}
