import type { BlogLocale } from "@loom/database";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { REVIEW_NOTE_MAX_LENGTH } from "../../constants/content.constants";

/** Sends a submission back to its Writer. The note is required: "changes requested" alone says nothing. */
export class RequestChangesRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(REVIEW_NOTE_MAX_LENGTH)
  note: NonNullable<BlogLocale["reviewNote"]>;
}
