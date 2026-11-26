import { Expose, Type } from "class-transformer";
import { CmsUserResponseDto } from "./cms-user-response.dto";
import { PasswordLinkResponseDto } from "./password-link-response.dto";

/** The person just added, and the link to send them — the only time the link can be seen. */
export class InvitedUserResponseDto {
  @Expose()
  @Type(() => CmsUserResponseDto)
  user: CmsUserResponseDto;

  @Expose()
  @Type(() => PasswordLinkResponseDto)
  link: PasswordLinkResponseDto;
}
