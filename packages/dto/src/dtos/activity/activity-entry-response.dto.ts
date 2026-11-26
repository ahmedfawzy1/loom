import type { AuditLog, Space } from "@loom/database";
import { Expose } from "class-transformer";

export class ActivityEntryResponseDto {
  @Expose()
  id: AuditLog["id"];

  @Expose()
  createdAt: AuditLog["createdAt"];

  @Expose()
  userId: AuditLog["userId"];

  /** Kept on the entry, so it still reads after the user is deleted. */
  @Expose()
  userEmail: AuditLog["userEmail"];

  @Expose()
  action: AuditLog["action"];

  @Expose()
  contentType: AuditLog["contentType"];

  @Expose()
  contentId: AuditLog["contentId"];

  /** The item's name now; null when it has since been deleted for good. */
  @Expose()
  contentTitle: string | null;

  @Expose()
  languageCode: AuditLog["languageCode"];

  @Expose()
  spaceId: AuditLog["spaceId"];

  @Expose()
  spaceName: Space["name"] | null;

  @Expose()
  metadata: AuditLog["metadata"];
}
