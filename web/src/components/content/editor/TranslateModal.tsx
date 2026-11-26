"use client";

import { Button, Checkbox, Modal, Switch, toast } from "@heroui/react";
import type {
  ContentItemResponseDto,
  FieldSyncState,
  LocaleStateResponseDto,
  TranslationResultResponseDto,
} from "@loom/dto";
import { translationState } from "@loom/dto/constants";
import type { CmsContentType, SiteLanguage } from "@loom/dto/models";
import { useEditor } from "@loom-web/src/components/content/editor/EditorContext";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { Pill } from "@loom-web/src/components/ui/Pill";
import { MISSING, StatusChip } from "@loom-web/src/components/ui/StatusChip";
import { fieldLabel } from "@loom-web/src/constants/translation";
import {
  useMarkCurrent,
  useTranslate,
  useTranslationFields,
  useTranslationUsage,
} from "@loom-web/src/hooks/content/useTranslation";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useState } from "react";

type LocaleState = Serialized<LocaleStateResponseDto>;
type Result = Serialized<TranslationResultResponseDto>;

const codesOf = (results: Result[]) =>
  results.map((result) => result.languageCode).join(", ");

/**
 * What a run did, as one toast. It has to outlive the dialog: a translation reloads the editor from
 * the server, which remounts the dialog closed.
 */
export const reportTranslation = (results: Result[]) => {
  const translated = results.filter(
    (result) => result.outcome === "translated",
  );
  const unchanged = results.filter((result) => result.outcome === "unchanged");
  const failed = results.filter((result) => result.outcome === "failed");
  const characters = results.reduce(
    (sum, result) => sum + result.characters,
    0,
  );
  const summary = [
    translated.length && `Translated into ${codesOf(translated)}`,
    unchanged.length && `${codesOf(unchanged)} already up to date`,
    characters && `${characters.toLocaleString()} DeepL characters`,
  ]
    .filter(Boolean)
    .join(" · ");

  if (failed.length)
    toast.danger(
      `Failed: ${failed.map((result) => `${result.languageCode} (${result.message ?? "no reason given"})`).join(", ")}`,
      summary ? { description: summary } : undefined,
    );
  else toast.success(summary || "Nothing to translate");
};

/**
 * Machine translation from the source language: the chosen languages, every missing one,
 * or every stale one. Nothing is published by it — a new language lands in Draft, and an existing one saves like
 * any edit. Fields someone wrote by hand stay as they are unless "replace everything" is on.
 */
export function TranslateModal({
  type,
  itemId,
  locales,
  isOpen,
  onClose,
  onTranslated,
}: {
  type: CmsContentType;
  itemId: ContentItemResponseDto["id"];
  locales: LocaleState[];
  isOpen: boolean;
  onClose: () => void;
  onTranslated: () => void;
}) {
  const { site } = useActiveSite();
  const translate = useTranslate();
  const markCurrent = useMarkCurrent();
  const { isDirty, saveAll } = useEditor();
  const { data: usage } = useTranslationUsage(site?.id);
  const { data: fieldStates } = useTranslationFields(type, itemId);
  const [selected, setSelected] = useState<Set<SiteLanguage["code"]>>(
    new Set(),
  );
  const [retranslate, setRetranslate] = useState(false);

  if (!site) return null;

  const source = locales.find(
    (locale) => locale.languageCode === site.defaultLanguage,
  );
  const translatable = site.languages
    .filter(
      (candidate) =>
        candidate.enabled &&
        candidate.code !== site.defaultLanguage &&
        candidate.deeplCode,
    )
    .sort((a, b) => a.position - b.position);
  const missing = translatable.filter(
    (candidate) =>
      !locales.some((locale) => locale.languageCode === candidate.code),
  );
  const stale = translatable.filter((candidate) => {
    const locale = locales.find((item) => item.languageCode === candidate.code);
    return locale && translationState(locale, source) === "stale";
  });
  const behindIn = (code: SiteLanguage["code"], ...states: FieldSyncState[]) =>
    (fieldStates?.find((entry) => entry.languageCode === code)?.fields ?? [])
      .filter((field) => states.includes(field.state))
      .map((field) => fieldLabel(field.name));

  // Both reload the editor from the server, so edits on screen are saved first — a translation is
  // then made from them, and "up to date" confirms the text as corrected rather than as stored
  const run = async (args: {
    languages?: string[];
    missing?: boolean;
    stale?: boolean;
  }) => {
    if (isDirty && !(await saveAll({ quiet: true }))) return;
    translate.mutate(
      { type, id: itemId, args: { ...args, retranslate } },
      {
        onSuccess: (outcome) => {
          reportTranslation(outcome);
          setSelected(new Set());
          // The language on screen may be one that was just rewritten
          onTranslated();
        },
      },
    );
  };

  const markUpToDate = async (language: SiteLanguage["code"]) => {
    if (isDirty && !(await saveAll({ quiet: true }))) return;
    markCurrent.mutate(
      { type, id: itemId, language },
      { onSuccess: onTranslated },
    );
  };

  const toggle = (code: SiteLanguage["code"]) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected(next);
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container className="w-full" placement="center">
        <Modal.Dialog className="max-w-xl rounded-xl p-0">
          <Modal.CloseTrigger />
          <Modal.Header className="border-border border-b px-5 py-4">
            <Modal.Heading className="font-semibold text-base">
              Translate from {site.defaultLanguage}
            </Modal.Heading>
            <p className="text-muted text-sm">
              Translations land as drafts and never publish on their own.
            </p>
          </Modal.Header>

          <Modal.Body className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto px-5 py-3">
            {!source && (
              <Notice tone="warning">
                Save the {site.defaultLanguage} version first; translations are
                made from it.
              </Notice>
            )}
            {isDirty && (
              <Notice>
                Your unsaved edits are saved first, so translations are made
                from what is on screen.
              </Notice>
            )}

            <ul className="flex flex-col">
              {translatable.map((candidate) => {
                const locale = locales.find(
                  (item) => item.languageCode === candidate.code,
                );
                const state = locale
                  ? translationState(locale, source)
                  : "source";
                return (
                  <li
                    className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-separator border-b py-1.5 last:border-b-0"
                    key={candidate.code}
                  >
                    <Checkbox
                      isDisabled={!source}
                      isSelected={selected.has(candidate.code)}
                      onChange={() => toggle(candidate.code)}
                    >
                      <Checkbox.Content className="flex-row items-center gap-3">
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <span className="w-36 truncate text-sm">
                          {candidate.nativeName}
                          <span className="ms-1.5 font-mono text-muted text-xs">
                            {candidate.code}
                          </span>
                        </span>
                      </Checkbox.Content>
                    </Checkbox>
                    <StatusChip status={locale?.status ?? MISSING} />
                    {state === "stale" && <Pill tone="warning">Stale</Pill>}
                    {state === "untracked" && (
                      <Pill title="Nothing records which source text this was written from">
                        Untracked
                      </Pill>
                    )}
                    {locale && (state === "stale" || state === "untracked") && (
                      <button
                        className="text-accent text-xs hover:underline"
                        disabled={markCurrent.isPending}
                        onClick={() => markUpToDate(candidate.code)}
                        title="Records that this language already says what the source says now"
                        type="button"
                      >
                        Mark up to date
                      </button>
                    )}
                    {state === "stale" && (
                      <p className="w-full ps-7 text-muted text-xs">
                        {behindIn(candidate.code, "changed", "copied").length >
                          0 &&
                          `To update: ${behindIn(candidate.code, "changed", "copied").join(", ")}. `}
                        {behindIn(candidate.code, "edited").length > 0 &&
                          `Edited there, so kept: ${behindIn(candidate.code, "edited").join(", ")}.`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Modal.Body>

          <Modal.Footer className="flex-col items-stretch gap-4 border-border border-t px-5 py-4">
            <Switch
              className="items-start"
              isSelected={retranslate}
              onChange={setRetranslate}
            >
              <Switch.Control className="mt-0.5 shrink-0">
                <Switch.Thumb />
              </Switch.Control>
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-sm">
                  Replace everything, including hand edits
                </span>
                <span className="text-muted text-xs">
                  Leave this off to update only what changed in{" "}
                  {site.defaultLanguage} and keep what people edited.
                </span>
              </span>
            </Switch>
            {(translate.error ?? markCurrent.error) && (
              <p className="text-danger-soft-foreground text-sm">
                {(translate.error ?? markCurrent.error)?.message}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <span className="text-muted text-xs">
                {translate.isPending
                  ? "Translating, a few seconds per language…"
                  : usage &&
                    `DeepL this month: ${usage.characters.toLocaleString()} characters`}
              </span>
              <div className="ms-auto flex flex-wrap justify-end gap-2">
                <Button
                  isDisabled={
                    !source || stale.length === 0 || translate.isPending
                  }
                  onPress={() => run({ stale: true })}
                  size="sm"
                  variant="secondary"
                >
                  Update stale ({stale.length})
                </Button>
                <Button
                  isDisabled={
                    !source || missing.length === 0 || translate.isPending
                  }
                  onPress={() => run({ missing: true })}
                  size="sm"
                  variant="secondary"
                >
                  All missing ({missing.length})
                </Button>
                <Button
                  isDisabled={
                    !source || selected.size === 0 || translate.isPending
                  }
                  onPress={() => run({ languages: [...selected] })}
                  size="sm"
                >
                  {selected.size
                    ? `Translate ${selected.size}`
                    : "Translate selected"}
                </Button>
              </div>
            </div>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
