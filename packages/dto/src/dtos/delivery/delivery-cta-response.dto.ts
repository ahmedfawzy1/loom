import type { Cta, CtaLocale } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { DeliveryMediaResponseDto } from "./delivery-media-response.dto";

export class DeliveryCtaResponseDto {
  @Expose()
  id: Cta["id"];

  /** The language this came from: the one asked for, or the default language when it is not live in it. */
  @Expose()
  languageCode: CtaLocale["languageCode"];

  @Expose()
  title: CtaLocale["title"];

  @Expose()
  description: CtaLocale["description"];

  @Expose()
  buttonLabel: CtaLocale["buttonLabel"];

  @Expose()
  url: Cta["url"];

  @Expose()
  cmpid: Cta["cmpid"];

  @Expose()
  @Type(() => DeliveryMediaResponseDto)
  image: DeliveryMediaResponseDto | null;
}
