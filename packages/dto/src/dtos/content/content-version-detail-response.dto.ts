import type { BlogVersion } from "@loom/database";
import { Expose } from "class-transformer";
import { ContentVersionResponseDto } from "./content-version-response.dto";

/** A version with its content, for previewing before a restore. */
export class ContentVersionDetailResponseDto extends ContentVersionResponseDto {
  /** The locale's fields as saved, plus the shared fields under `canonical`. */
  @Expose()
  snapshot: BlogVersion["snapshot"];
}
