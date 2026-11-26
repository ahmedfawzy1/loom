import type { Site } from "@loom/database";
import { Expose, Transform, Type } from "class-transformer";
import { SpaceResponseDto } from "../space/space-response.dto";
import { SiteLanguageResponseDto } from "./site-language-response.dto";

export class SiteResponseDto
  implements
    Pick<
      Site,
      | "id"
      | "name"
      | "slug"
      | "domain"
      | "defaultLanguage"
      | "protectedTerms"
      | "revalidateUrl"
      | "previewUrl"
    >
{
  @Expose()
  id: Site["id"];

  @Expose()
  name: Site["name"];

  @Expose()
  slug: Site["slug"];

  @Expose()
  domain: Site["domain"];

  @Expose()
  defaultLanguage: Site["defaultLanguage"];

  @Expose()
  protectedTerms: Site["protectedTerms"];

  @Expose()
  revalidateUrl: Site["revalidateUrl"];

  // The signing secret behind it (previewSecret) is never exposed, not even as a flag
  @Expose()
  previewUrl: Site["previewUrl"];

  /**
   * The secret itself is never sent back — only whether one is set. Derived here from the Site row
   * as it is serialised, so the services that return a Site do not each compute it.
   */
  @Expose()
  @Transform(({ obj }) => Boolean((obj as Site).revalidateSecret), {
    toClassOnly: true,
  })
  hasRevalidateSecret?: boolean;

  @Expose()
  @Type(() => SiteLanguageResponseDto)
  languages: SiteLanguageResponseDto[];

  @Expose()
  @Type(() => SpaceResponseDto)
  spaces: SpaceResponseDto[];
}
