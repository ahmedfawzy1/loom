import { CmsRole, type CmsUser } from "@loom/database";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import {
  EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
} from "../../constants/validation.constants";

/** An Admin adding someone. The role is chosen now, so nobody is ever signed in without one. */
export class InviteUserRequestDto {
  @IsEmail({}, { message: "Enter a valid email address" })
  @MaxLength(EMAIL_MAX_LENGTH)
  email: CmsUser["email"];

  @IsOptional()
  @IsString()
  @MaxLength(USER_NAME_MAX_LENGTH)
  name?: NonNullable<CmsUser["name"]>;

  @IsEnum(CmsRole)
  role: CmsUser["role"];
}
