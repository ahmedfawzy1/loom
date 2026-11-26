import { Expose, Type } from "class-transformer";
import { DeliveryAlternateResponseDto } from "./delivery-alternate-response.dto";
import { DeliveryTagResponseDto } from "./delivery-tag-response.dto";

export class DeliveryTagDetailResponseDto extends DeliveryTagResponseDto {
  @Expose()
  @Type(() => DeliveryAlternateResponseDto)
  alternates: DeliveryAlternateResponseDto[];
}
