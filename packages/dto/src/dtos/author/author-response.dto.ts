import type { Author } from "@loom/database";
import { Expose, Type } from "class-transformer";
import { AuthorLocaleResponseDto } from "./author-locale-response.dto";

export class AuthorResponseDto {
  @Expose()
  id: Author["id"];

  @Expose()
  spaceId: Author["spaceId"];

  @Expose()
  name: Author["name"];

  @Expose()
  profileImageId: Author["profileImageId"];

  @Expose()
  socialLinks: Author["socialLinks"];

  @Expose()
  createdAt: Author["createdAt"];

  @Expose()
  updatedAt: Author["updatedAt"];

  @Expose()
  deletedAt: Author["deletedAt"];

  @Expose()
  @Type(() => AuthorLocaleResponseDto)
  locales: AuthorLocaleResponseDto[];
}
