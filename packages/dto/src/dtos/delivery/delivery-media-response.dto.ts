import type { Media } from "@loom/database";
import { Expose } from "class-transformer";

export class DeliveryMediaResponseDto {
  @Expose()
  id: Media["id"];

  @Expose()
  url: string;

  @Expose()
  altText: Media["altText"];

  @Expose()
  mimeType: Media["mimeType"];

  @Expose()
  width: Media["width"];

  @Expose()
  height: Media["height"];
}
