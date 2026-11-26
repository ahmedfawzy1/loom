import { CmsRole, type CmsUser } from "@loom/database";
import { IsEnum } from "class-validator";

export class UpdateUserRoleRequestDto {
  @IsEnum(CmsRole)
  role: CmsUser["role"];
}
