import { Expose, Type } from "class-transformer";
import { DeliveryCtaResponseDto } from "./delivery-cta-response.dto";
import { DeliveryEntryLinkResponseDto } from "./delivery-entry-link-response.dto";
import { DeliveryMediaResponseDto } from "./delivery-media-response.dto";

/**
 * Everything a body refers to, resolved once. The body keeps only ids; a reference missing
 * here points at something no longer live, and the website renders it as nothing.
 */
export class DeliveryIncludesResponseDto {
  @Expose()
  @Type(() => DeliveryMediaResponseDto)
  media: DeliveryMediaResponseDto[];

  @Expose()
  @Type(() => DeliveryCtaResponseDto)
  ctas: DeliveryCtaResponseDto[];

  @Expose()
  @Type(() => DeliveryEntryLinkResponseDto)
  entries: DeliveryEntryLinkResponseDto[];
}
