import type { Media } from "@loom/database";
import { Expose } from "class-transformer";

export class MediaResponseDto {
  @Expose()
  id: Media["id"];

  @Expose()
  filename: Media["filename"];

  @Expose()
  altText: Media["altText"];

  @Expose()
  mimeType: Media["mimeType"];

  @Expose()
  width: Media["width"];

  @Expose()
  height: Media["height"];

  @Expose()
  sizeBytes: Media["sizeBytes"];

  /** Where the image is served from — straight from the bucket. */
  @Expose()
  url: string;

  @Expose()
  createdAt: Media["createdAt"];

  /** Set when removed from the library. Content already using it still renders it. */
  @Expose()
  deletedAt: Media["deletedAt"];
}
