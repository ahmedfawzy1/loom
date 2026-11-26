import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { PASSWORD_LINK_TOKEN_MAX_LENGTH } from "../../constants/validation.constants";

/** The token from a password link, sent in a body rather than a URL so it stays out of logs. */
export class PasswordLinkTokenRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_LINK_TOKEN_MAX_LENGTH)
  token: string;
}
