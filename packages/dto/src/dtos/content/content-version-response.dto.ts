import type { BlogVersion } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { ContentUserResponseDto } from "./content-user-response.dto";

export class ContentVersionResponseDto {
  @Expose()
  revision: BlogVersion["revision"];

  @Expose()
  note: BlogVersion["note"];

  @Expose()
  createdAt: BlogVersion["createdAt"];

  /** Null for a version written by the system, or by a user since deleted. */
  @Expose()
  @Type(() => ContentUserResponseDto)
  createdBy: ContentUserResponseDto | null;

  /** The version the website is serving. */
  @Expose()
  isPublished: boolean;

  /** The version the editor is showing. */
  @Expose()
  isCurrent: boolean;
}
