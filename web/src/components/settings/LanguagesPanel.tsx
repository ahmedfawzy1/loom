"use client";

import { Button, cn, Switch, toast } from "@heroui/react";
import type { SiteResponseDto, UpdateSiteLanguageRequestDto } from "@loom/dto";
import type { SiteLanguage } from "@loom/dto/models";
import { SettingsPanel } from "@loom-web/src/components/settings/SettingsPanel";
import { Pill } from "@loom-web/src/components/ui/Pill";
import { useUpdateSiteLanguages } from "@loom-web/src/hooks/site/useSiteQueries";
import { useState } from "react";

function LanguagesTable({ site }: { site: Serialized<SiteResponseDto> }) {
  const updateLanguages = useUpdateSiteLanguages();
  const [pending, setPending] = useState<
    Map<SiteLanguage["code"], UpdateSiteLanguageRequestDto>
  >(new Map());

  const enabledOf = (
    code: SiteLanguage["code"],
    fallback: SiteLanguage["enabled"],
  ) => pending.get(code)?.enabled ?? fallback;
  const enabledCount = site.languages.filter((language) =>
    enabledOf(language.code, language.enabled),
  ).length;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-4 border-border border-b px-4 py-2.5">
        <span className="text-muted text-xs tabular-nums">
          {enabledCount} of {site.languages.length} enabled
          {pending.size > 0 &&
            ` · ${pending.size} unsaved change${pending.size === 1 ? "" : "s"}`}
        </span>
        <Button
          isDisabled={updateLanguages.isPending || pending.size === 0}
          onPress={() =>
            updateLanguages.mutate(
              { siteId: site.id, languages: [...pending.values()] },
              {
                onSuccess: () => {
                  setPending(new Map());
                  toast.success("Languages saved");
                },
                onError: (error) => toast.danger(error.message),
              },
            )
          }
          size="sm"
        >
          {updateLanguages.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <table className="w-full text-sm">
        <thead className="border-border border-b text-muted text-xs">
          <tr>
            <th className="px-4 py-2 text-start font-medium">Language</th>
            <th className="w-20 px-4 py-2 text-start font-medium">Code</th>
            <th className="w-20 px-4 py-2 text-start font-medium">URL</th>
            <th className="w-24 px-4 py-2 text-start font-medium">DeepL</th>
            <th className="w-20 px-4 py-2 text-end font-medium">Enabled</th>
          </tr>
        </thead>
        <tbody>
          {site.languages.map((language) => {
            const isDefault = language.code === site.defaultLanguage;
            const isEnabled = enabledOf(language.code, language.enabled);
            return (
              <tr
                className={cn(
                  "border-separator border-b transition-colors duration-fast last:border-b-0 hover:bg-surface-secondary",
                  pending.has(language.code) && "bg-accent-soft/40",
                )}
                key={language.code}
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(!isEnabled && "text-muted")}>
                      {language.label}
                    </span>
                    <span className="truncate text-muted text-xs">
                      {language.nativeName}
                    </span>
                    {isDefault && <Pill tone="accent">Default</Pill>}
                    {language.rtl && <Pill dot={false}>RTL</Pill>}
                  </div>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{language.code}</td>
                <td className="px-4 py-2 font-mono text-muted text-xs">
                  {language.urlPrefix || "/"}
                </td>
                <td className="px-4 py-2 font-mono text-muted text-xs">
                  {language.deeplCode ?? "source"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end">
                    <Switch
                      aria-label={`Enable ${language.label}`}
                      // The default language is what every translation is derived from
                      isDisabled={isDefault}
                      isSelected={isEnabled}
                      onChange={(enabled) =>
                        setPending((previous) =>
                          new Map(previous).set(language.code, {
                            code: language.code,
                            enabled,
                          }),
                        )
                      }
                      size="sm"
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LanguagesPanel() {
  return (
    <SettingsPanel>{(site) => <LanguagesTable site={site} />}</SettingsPanel>
  );
}
