import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/** The token a Preview link carried to the website, which the website asks Loom to resolve. */
export class DeliveryPreviewRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  token: string;
}
