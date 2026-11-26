import { Expose } from "class-transformer";

export class DeliveryFaqItemResponseDto {
  @Expose()
  question: string;

  @Expose()
  answer: string;
}
