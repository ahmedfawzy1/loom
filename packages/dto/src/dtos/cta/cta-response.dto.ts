import type { Cta } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { CtaLocaleResponseDto } from "./cta-locale-response.dto";

export class CtaResponseDto {
  @Expose()
  id: Cta["id"];

  @Expose()
  spaceId: Cta["spaceId"];

  @Expose()
  url: Cta["url"];

  @Expose()
  cmpid: Cta["cmpid"];

  @Expose()
  imageId: Cta["imageId"];

  @Expose()
  createdAt: Cta["createdAt"];

  @Expose()
  updatedAt: Cta["updatedAt"];

  @Expose()
  deletedAt: Cta["deletedAt"];

  @Expose()
  @Type(() => CtaLocaleResponseDto)
  locales: CtaLocaleResponseDto[];
}
