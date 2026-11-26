"use client";

import { Button, cn } from "@heroui/react";
import type { ContentItemResponseDto, LocaleStateResponseDto } from "@loom/dto";
import { translationState } from "@loom/dto/constants";
import {
  type CmsContentType,
  CmsRole,
  LocaleStatus,
  type SiteLanguage,
} from "@loom/dto/models";
import { PublishLanguagesModal } from "@loom-web/src/components/content/editor/PublishLanguagesModal";
import { TranslateModal } from "@loom-web/src/components/content/editor/TranslateModal";
import { statusLabel } from "@loom-web/src/components/ui/StatusChip";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useCurrentUser } from "@loom-web/src/hooks/user/useCurrentUser";
import { useContextStore } from "@loom-web/src/stores/context";
import { confirmDiscard } from "@loom-web/src/stores/unsaved";
import { Translate, UploadSimple } from "@phosphor-icons/react";
import { useState } from "react";

type LocaleState = Serialized<LocaleStateResponseDto>;

// Solid for a version with work in it, hollow for one taken off the site; a missing language has none
const DOTS: Record<LocaleStatus, string> = {
  [LocaleStatus.PUBLISHED]: "bg-success",
  [LocaleStatus.CHANGED]: "bg-warning",
  [LocaleStatus.IN_REVIEW]: "bg-review",
  [LocaleStatus.DRAFT]: "bg-foreground/45",
  [LocaleStatus.UNPUBLISHED]: "border-[1.5px] border-foreground/45",
};

const LEGEND: { label: string; dot: string }[] = [
  { label: "Live", dot: DOTS[LocaleStatus.PUBLISHED] },
  { label: "Changed", dot: DOTS[LocaleStatus.CHANGED] },
  { label: "In review", dot: DOTS[LocaleStatus.IN_REVIEW] },
  { label: "Draft", dot: DOTS[LocaleStatus.DRAFT] },
  { label: "Unpublished", dot: DOTS[LocaleStatus.UNPUBLISHED] },
];

/**
 * Every language of the item at a glance, one chip per language. A
 * chip opens that language; the dot is its status (see the legend), a dashed chip has no version
 * yet, and an amber edge marks a stale translation.
 */
export function LanguagePanel({
  type,
  itemId,
  locales,
  onTranslated,
}: {
  type: CmsContentType;
  itemId: ContentItemResponseDto["id"];
  locales: LocaleState[];
  onTranslated: () => void;
}) {
  const { site } = useActiveSite();
  const language = useContextStore((state) => state.languageCode);
  const setLanguage = useContextStore((state) => state.setLanguage);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const { data: user } = useCurrentUser();
  const canPublish =
    user?.role === CmsRole.ADMIN || user?.role === CmsRole.AUTHOR;

  if (!site) return null;

  const source = locales.find(
    (locale) => locale.languageCode === site.defaultLanguage,
  );
  const languages = site.languages
    .filter((candidate) => candidate.enabled)
    .sort((a, b) => a.position - b.position);
  const live = locales.filter(
    (locale) => locale.publishedRevision !== null,
  ).length;
  const stale = locales.filter(
    (locale) => translationState(locale, source) === "stale",
  ).length;

  const open = (code: SiteLanguage["code"]) => {
    if (code === language || !confirmDiscard()) return;
    setLanguage(code);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-xs">
        Live in {live} of {languages.length}
        {stale > 0 && (
          <span className="text-warning-soft-foreground"> · {stale} stale</span>
        )}
      </p>

      <div className="grid grid-cols-5 gap-1">
        {languages.map((candidate) => {
          const locale = locales.find(
            (item) => item.languageCode === candidate.code,
          );
          const isStale =
            locale && translationState(locale, source) === "stale";
          const isCurrent = candidate.code === language;
          return (
            <button
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                "flex h-7 items-center justify-center gap-1.5 rounded-md border font-mono text-xs transition-colors duration-fast",
                isCurrent
                  ? "border-accent bg-accent-soft text-accent-soft-foreground"
                  : "border-transparent bg-surface-secondary hover:border-border",
                !locale &&
                  !isCurrent &&
                  "border-border border-dashed bg-transparent text-muted/70",
                isStale && !isCurrent && "border-warning/60",
              )}
              key={candidate.code}
              onClick={() => open(candidate.code)}
              title={`${candidate.label} (${candidate.nativeName}): ${
                locale ? statusLabel(locale.status) : "Missing"
              }${isStale ? ", stale" : ""}`}
              type="button"
            >
              {locale && (
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    DOTS[locale.status],
                  )}
                />
              )}
              {candidate.code}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {LEGEND.map((entry) => (
          <li className="flex items-center gap-1.5" key={entry.label}>
            <span className={cn("size-2 rounded-full", entry.dot)} />
            {entry.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-sm border border-border border-dashed" />
          Missing
        </li>
      </ul>

      <div className="flex gap-2">
        <Button
          className="flex-1"
          onPress={() => setIsTranslating(true)}
          size="sm"
          variant="secondary"
        >
          <Translate className="size-4" />
          Translate…
        </Button>
        {canPublish && (
          <Button
            className="flex-1"
            onPress={() => setIsPublishing(true)}
            size="sm"
            variant="secondary"
          >
            <UploadSimple className="size-4" />
            Publish…
          </Button>
        )}
      </div>

      <PublishLanguagesModal
        isOpen={isPublishing}
        itemId={itemId}
        locales={locales}
        onClose={() => setIsPublishing(false)}
        type={type}
      />
      <TranslateModal
        isOpen={isTranslating}
        itemId={itemId}
        locales={locales}
        onClose={() => setIsTranslating(false)}
        onTranslated={onTranslated}
        type={type}
      />
    </div>
  );
}
