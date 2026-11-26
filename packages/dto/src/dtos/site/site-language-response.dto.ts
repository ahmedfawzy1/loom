import type { SiteLanguage } from "@loom/database";
import { Expose } from "class-transformer";

export class SiteLanguageResponseDto
  implements
    Pick<
      SiteLanguage,
      | "code"
      | "label"
      | "nativeName"
      | "deeplCode"
      | "urlPrefix"
      | "rtl"
      | "enabled"
      | "position"
    >
{
  @Expose()
  code: SiteLanguage["code"];

  @Expose()
  label: SiteLanguage["label"];

  @Expose()
  nativeName: SiteLanguage["nativeName"];

  @Expose()
  deeplCode: SiteLanguage["deeplCode"];

  @Expose()
  urlPrefix: SiteLanguage["urlPrefix"];

  @Expose()
  rtl: SiteLanguage["rtl"];

  @Expose()
  enabled: SiteLanguage["enabled"];

  @Expose()
  position: SiteLanguage["position"];
}
