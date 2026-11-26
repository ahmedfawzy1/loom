import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";
import {
  PASSWORD_LINK_TOKEN_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../../constants/validation.constants";

/** Choosing a password through a link: the invite's first, or a reset's replacement. */
export class SetPasswordRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_LINK_TOKEN_MAX_LENGTH)
  token: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Choose a password of at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `Choose a password of at most ${PASSWORD_MAX_LENGTH} characters`,
  })
  password: string;
}
