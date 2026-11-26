"use client";

import { cn, Dropdown, Label } from "@heroui/react";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useContextStore } from "@loom-web/src/stores/context";
import { confirmDiscard } from "@loom-web/src/stores/unsaved";
import { CaretDown, Check, Translate } from "@phosphor-icons/react";

/**
 * The language every screen reads and edits in. It sits in the top bar because it changes what
 * each list and editor shows — the one context an editor switches many times a session.
 */
export function LanguageSwitcher() {
  const { site } = useActiveSite();
  const languageCode = useContextStore((state) => state.languageCode);
  const setLanguage = useContextStore((state) => state.setLanguage);

  if (!site) return null;

  const languages = site.languages
    .filter((language) => language.enabled)
    .sort((a, b) => a.position - b.position);
  const current = languages.find((language) => language.code === languageCode);

  return (
    <Dropdown>
      <Dropdown.Trigger className="flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-sm transition-colors duration-fast hover:bg-surface-secondary data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus">
        <Translate className="size-4 text-muted" />
        <span className="font-medium">{current?.label ?? languageCode}</span>
        <span className="font-mono text-muted text-xs">{languageCode}</span>
        {languageCode === site.defaultLanguage && (
          <span className="rounded bg-surface-tertiary px-1 text-[10px] text-muted">
            source
          </span>
        )}
        <CaretDown className="size-3.5 text-muted" />
      </Dropdown.Trigger>
      <Dropdown.Popover className="max-h-96 min-w-56" placement="bottom end">
        <Dropdown.Menu
          aria-label="Work in language"
          onAction={(key) => {
            if (String(key) === languageCode || !confirmDiscard()) return;
            setLanguage(String(key));
          }}
        >
          {languages.map((language) => (
            <Dropdown.Item
              id={language.code}
              key={language.code}
              textValue={`${language.label} ${language.nativeName}`}
            >
              <Label className="flex-1">
                {language.label}
                <span className="ms-1.5 text-muted text-xs">
                  {language.nativeName}
                </span>
              </Label>
              <span className="font-mono text-muted text-xs">
                {language.code}
              </span>
              <Check
                className={cn(
                  "size-4 text-accent",
                  language.code !== languageCode && "invisible",
                )}
              />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
