import { Expose, Type } from "class-transformer";
import { DeliveryAlternateResponseDto } from "./delivery-alternate-response.dto";
import { DeliveryCategoryResponseDto } from "./delivery-category-response.dto";

export class DeliveryCategoryDetailResponseDto extends DeliveryCategoryResponseDto {
  @Expose()
  @Type(() => DeliveryAlternateResponseDto)
  alternates: DeliveryAlternateResponseDto[];
}
