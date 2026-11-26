import type { PendingUpload } from "@loom/database";
import { Expose } from "class-transformer";

/** A presigned POST: send `fields` then the file, as multipart form data, to `url`. */
export class MediaUploadResponseDto {
  /** Hand this back to confirm or replace once the POST has succeeded. */
  @Expose()
  key: PendingUpload["key"];

  @Expose()
  url: string;

  /** The signed policy. Storage refuses the upload unless every one is sent unchanged. */
  @Expose()
  fields: Record<string, string>;
}
