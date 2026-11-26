import type { CmsUser } from "@loom/database";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "../../constants/validation.constants";

/**
 * Deliberately loose: neither the email's shape nor the password's length is checked here, so a
 * wrong guess gets the same answer as any other wrong guess, and a password chosen under an older
 * minimum still works.
 */
export class LoginRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: CmsUser["email"];

  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
