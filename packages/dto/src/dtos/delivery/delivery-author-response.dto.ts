import type { Author, AuthorLocale } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { DeliveryMediaResponseDto } from "./delivery-media-response.dto";

export class DeliveryAuthorResponseDto {
  @Expose()
  id: Author["id"];

  /** The language this came from: the one asked for, or the default language when it is not live in it. */
  @Expose()
  languageCode: AuthorLocale["languageCode"];

  @Expose()
  name: Author["name"];

  @Expose()
  jobTitle: AuthorLocale["jobTitle"];

  @Expose()
  bio: AuthorLocale["bio"];

  @Expose()
  socialLinks: Author["socialLinks"];

  @Expose()
  @Type(() => DeliveryMediaResponseDto)
  profileImage: DeliveryMediaResponseDto | null;
}
