"use client";

import { cn } from "@heroui/react";
import { Section } from "@loom-web/src/components/ui/Section";
import type { Theme } from "@loom-web/src/constants/theme";
import { useThemeStore } from "@loom-web/src/stores/theme";
import { CheckCircle } from "@phosphor-icons/react";

const OPTIONS: { theme: Theme; label: string; hint: string }[] = [
  { theme: "dark", label: "Dark", hint: "The default" },
  { theme: "light", label: "Light", hint: "Paper for daylight" },
  { theme: "system", label: "System", hint: "Follows your device" },
];

/**
 * A miniature of the CMS in one theme. The tokens are keyed on data-theme, so setting it on this box
 * draws it in that theme whatever the page around it is using.
 */
function Miniature({ theme }: { theme: "dark" | "light" }) {
  return (
    <div
      className="flex h-full bg-background text-foreground"
      data-theme={theme}
    >
      <div className="flex w-1/4 flex-col gap-1.5 bg-sidebar p-2">
        <span className="h-2 w-3/4 rounded-sm bg-accent" />
        <span className="h-1.5 w-full rounded-sm bg-surface-tertiary" />
        <span className="h-1.5 w-2/3 rounded-sm bg-surface-tertiary" />
        <span className="h-1.5 w-3/4 rounded-sm bg-surface-tertiary" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <span className="h-2 w-1/2 rounded-sm bg-foreground/80" />
        <div className="flex flex-1 flex-col gap-1 rounded-md border border-border bg-surface p-1.5">
          <span className="h-1.5 w-full rounded-sm bg-surface-tertiary" />
          <span className="h-1.5 w-5/6 rounded-sm bg-surface-tertiary" />
          <span className="mt-auto h-2.5 w-1/3 self-end rounded-sm bg-accent" />
        </div>
      </div>
    </div>
  );
}

export function AppearancePanel() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <Section title="Theme">
      <fieldset aria-label="Theme" className="grid gap-4 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const isSelected = theme === option.theme;
          return (
            <button
              aria-pressed={isSelected}
              className={cn(
                "flex flex-col overflow-hidden rounded-xl border border-border text-start transition-colors duration-fast hover:border-accent/50",
                isSelected && "border-accent ring-2 ring-accent/30",
              )}
              key={option.theme}
              onClick={() => setTheme(option.theme)}
              type="button"
            >
              <div className="aspect-[16/9] w-full">
                {option.theme === "system" ? (
                  <div className="grid h-full grid-cols-2">
                    <div className="overflow-hidden">
                      <Miniature theme="dark" />
                    </div>
                    <div className="overflow-hidden">
                      <Miniature theme="light" />
                    </div>
                  </div>
                ) : (
                  <Miniature theme={option.theme} />
                )}
              </div>
              <div className="flex items-center gap-2 border-border border-t bg-surface px-3 py-2.5">
                <div className="flex flex-1 flex-col">
                  <span className="font-medium text-sm">{option.label}</span>
                  <span className="text-muted text-xs">{option.hint}</span>
                </div>
                {isSelected && (
                  <CheckCircle className="size-5 text-accent" weight="fill" />
                )}
              </div>
            </button>
          );
        })}
      </fieldset>
    </Section>
  );
}
