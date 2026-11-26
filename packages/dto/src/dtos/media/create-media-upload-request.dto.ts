import type { Media } from "@loom/database";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  MEDIA_ALLOWED_MIME_TYPES,
  MEDIA_FILENAME_MAX_LENGTH,
  MEDIA_MAX_UPLOAD_BYTES,
} from "../../constants/validation.constants";

/** Asks for a presigned URL. Nothing here is trusted — the stored object is re-checked on confirm. */
export class CreateMediaUploadRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MEDIA_FILENAME_MAX_LENGTH)
  filename: Media["filename"];

  @IsIn(MEDIA_ALLOWED_MIME_TYPES)
  mimeType: Media["mimeType"];

  @IsInt()
  @Min(1)
  @Max(MEDIA_MAX_UPLOAD_BYTES)
  sizeBytes: Media["sizeBytes"];
}
