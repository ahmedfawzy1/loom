import { type CmsUser, CmsUserStatus } from "@loom/database";
import { IsIn } from "class-validator";

// PENDING is not settable — an account is PENDING exactly while its owner has no password. ACTIVE
// reactivates a disabled account, which returns to PENDING if its owner never chose one.
export class UpdateUserStatusRequestDto {
  @IsIn([CmsUserStatus.ACTIVE, CmsUserStatus.DISABLED])
  status: CmsUser["status"];
}
