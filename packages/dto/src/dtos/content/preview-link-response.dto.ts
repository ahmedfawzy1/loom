import { Expose } from "class-transformer";

/** A Preview link for the editor to open: the Site's preview URL with a signed, short-lived token. */
export class PreviewLinkResponseDto {
  @Expose()
  url: string;

  @Expose()
  expiresAt: Date;
}
