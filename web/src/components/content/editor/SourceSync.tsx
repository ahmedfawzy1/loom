"use client";

import type {
  AuthorLocaleResponseDto,
  BlogLocaleResponseDto,
  CategoryLocaleResponseDto,
  ContentItemResponseDto,
  CtaLocaleResponseDto,
  FieldSyncState,
  TagLocaleResponseDto,
} from "@loom/dto";
import type { CmsContentType, SiteLanguage } from "@loom/dto/models";
import { Pill } from "@loom-web/src/components/ui/Pill";
import { useTranslationFields } from "@loom-web/src/hooks/content/useTranslation";
import { useContextStore } from "@loom-web/src/stores/context";
import { confirmDiscard } from "@loom-web/src/stores/unsaved";
import { createContext, type ReactNode, useContext } from "react";

interface SourceSync {
  sourceLanguage: SiteLanguage["code"];
  stateOf: (name: string) => FieldSyncState | undefined;
  /** The source language's current value of a field, to translate from by eye. */
  sourceValueOf: (name: string) => unknown;
}

/** A locale as an item response carries it: its state and every field of its text. */
export type ContentLocale = Serialized<
  | BlogLocaleResponseDto
  | CategoryLocaleResponseDto
  | TagLocaleResponseDto
  | AuthorLocaleResponseDto
  | CtaLocaleResponseDto
>;

const SourceSyncContext = createContext<SourceSync | null>(null);

/** Null outside an editor, or in the source language, where nothing can be behind. */
export const useFieldSync = (name: string | undefined) => {
  const sync = useContext(SourceSyncContext);
  const state = name ? sync?.stateOf(name) : undefined;
  if (!sync || !name || !state) return null;
  return {
    state,
    sourceLanguage: sync.sourceLanguage,
    sourceValue: sync.sourceValueOf(name),
  };
};

/**
 * Tells each field of a translation whether its source changed since it was translated, so the
 * editor marks exactly what is out of date rather than only saying the language is Stale.
 */
export function SourceSyncProvider({
  type,
  itemId,
  language,
  sourceLanguage,
  source,
  children,
}: {
  type: CmsContentType;
  itemId: ContentItemResponseDto["id"];
  language: SiteLanguage["code"];
  sourceLanguage: SiteLanguage["code"] | undefined;
  /** The source language's locale, whole, as an item response carries it. */
  source: ContentLocale | undefined;
  children: ReactNode;
}) {
  const { data } = useTranslationFields(type, itemId);
  const fields = data?.find((entry) => entry.languageCode === language)?.fields;

  if (!sourceLanguage || language === sourceLanguage || !fields?.length)
    return children;

  return (
    <SourceSyncContext.Provider
      value={{
        sourceLanguage,
        stateOf: (name) => fields.find((field) => field.name === name)?.state,
        // Looked up by the API's field name, which each locale type spells as its own property
        sourceValueOf: (name) =>
          (source as Record<string, unknown> | undefined)?.[name],
      }}
    >
      {children}
    </SourceSyncContext.Provider>
  );
}

const BADGES: Record<FieldSyncState, (language: string) => string> = {
  changed: (language) => `Changed in ${language}`,
  edited: (language) => `Changed in ${language} · edited here`,
  untracked: (language) => `May differ from ${language}`,
  copied: (language) => `Changed in ${language}`,
};

const HINTS: Record<FieldSyncState, string> = {
  changed: "Still as translated, so Update from the status panel refreshes it.",
  edited:
    "Someone edited this here, so updating keeps it unless you choose to replace your edits.",
  untracked:
    "Nothing records what this was translated from. Compare it with the source.",
  copied:
    "The same in every language, so updating copies it over as it is, with no DeepL characters.",
};

/** The mark on a field whose source moved on, with what an update would do to it. */
export function SourceBadge({
  state,
  sourceLanguage,
}: {
  state: FieldSyncState;
  sourceLanguage: SiteLanguage["code"];
}) {
  return (
    <Pill
      title={HINTS[state]}
      tone={state === "untracked" ? "neutral" : "warning"}
    >
      {BADGES[state](sourceLanguage)}
    </Pill>
  );
}

/**
 * For the fields too big to show inline — the body, the FAQ — the badge and a way over to the
 * source language to read what changed.
 */
export function FieldSourceNote({ name }: { name: string }) {
  const sync = useFieldSync(name);
  const setLanguage = useContextStore((state) => state.setLanguage);
  if (!sync) return null;

  return (
    <span className="flex items-center gap-2">
      <SourceBadge sourceLanguage={sync.sourceLanguage} state={sync.state} />
      <button
        className="text-accent text-xs hover:underline"
        onClick={() => {
          if (confirmDiscard()) setLanguage(sync.sourceLanguage);
        }}
        type="button"
      >
        Open {sync.sourceLanguage}
      </button>
    </span>
  );
}
