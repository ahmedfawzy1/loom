"use client";

import { Button, TextArea, TextField, toast } from "@heroui/react";
import type {
  BlockingReferenceResponseDto,
  FieldSyncState,
  LocaleStateResponseDto,
} from "@loom/dto";
import { REVIEW_NOTE_MAX_LENGTH, translationState } from "@loom/dto/constants";
import { CmsRole, LocaleStatus } from "@loom/dto/models";
import { useEditor } from "@loom-web/src/components/content/editor/EditorContext";
import {
  canPublishFirst,
  PublishReferencesModal,
} from "@loom-web/src/components/content/editor/PublishReferencesModal";
import { reportTranslation } from "@loom-web/src/components/content/editor/TranslateModal";
import {
  LiveUsageWarning,
  REFERENCED_TYPES,
} from "@loom-web/src/components/content/LiveUsageWarning";
import { VersionHistoryModal } from "@loom-web/src/components/content/VersionHistoryModal";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { MISSING, StatusChip } from "@loom-web/src/components/ui/StatusChip";
import { fieldLabel } from "@loom-web/src/constants/translation";
import {
  useMarkCurrent,
  useTranslate,
  useTranslationFields,
} from "@loom-web/src/hooks/content/useTranslation";
import {
  type LocaleStep,
  useLocaleStep,
} from "@loom-web/src/hooks/content/useWorkflow";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useCurrentUser } from "@loom-web/src/hooks/user/useCurrentUser";
import { workflow } from "@loom-web/src/lib/api";
import type { LocaleRef } from "@loom-web/src/lib/api/workflow";
import { CheckCircle, ClockCounterClockwise } from "@phosphor-icons/react";
import { useState } from "react";

type LocaleState = Serialized<LocaleStateResponseDto>;
type Blocker = Serialized<BlockingReferenceResponseDto>;

// What a Writer can send for review: anything with an edit that is not already waiting or live
const SUBMITTABLE: LocaleState["status"][] = [
  LocaleStatus.DRAFT,
  LocaleStatus.CHANGED,
  LocaleStatus.UNPUBLISHED,
];

const DONE: Record<LocaleStep, string> = {
  submit: "Submitted for review",
  approve: "Approved and published",
  requestChanges: "Sent back to the writer",
  publish: "Published",
  unpublish: "Unpublished",
};

function useRoles() {
  const { data: user } = useCurrentUser();
  return {
    canPublish: user?.role === CmsRole.ADMIN || user?.role === CmsRole.AUTHOR,
    isWriter: user?.role === CmsRole.WRITER,
  };
}

/** Runs a step on this language, saying how it went. */
function useRunStep(localeRef: LocaleRef) {
  const step = useLocaleStep();
  const run = (action: LocaleStep, note?: string, detail?: string) =>
    step
      .mutateAsync({ step: action, ref: localeRef, note })
      .then(() => {
        toast.success(
          `${DONE[action]} in ${localeRef.language}`,
          detail ? { description: detail } : undefined,
        );
        return true;
      })
      .catch((error: Error) => {
        toast.danger(error.message);
        return false;
      });
  return { run, isPending: step.isPending };
}

/**
 * The header's main action for this language — publish, approve, or submit, per role. Unsaved edits are saved first, so what goes live or to review is what is on screen.
 */
export function PrimaryAction({
  locale,
  localeRef,
}: {
  locale: LocaleState | undefined;
  localeRef: LocaleRef;
}) {
  const { canPublish, isWriter } = useRoles();
  const { isDirty, isSaving, saveAll } = useEditor();
  const { run, isPending } = useRunStep(localeRef);
  const referenceStep = useLocaleStep();
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [waiting, setWaiting] = useState<LocaleStep>("publish");
  const [isPublishingAll, setIsPublishingAll] = useState(false);
  const isBusy = isPending || isSaving || isPublishingAll;

  const saveThen = async (action: LocaleStep) => {
    if (isDirty && !(await saveAll({ quiet: true }))) return;
    await run(action);
  };

  // Going live first asks what the saved version points at that isn't live, so the answer can be
  // "publish those too" rather than the gate's refusal
  const goLive = async (action: LocaleStep) => {
    if (isDirty && !(await saveAll({ quiet: true }))) return;
    const found = await workflow
      .blockingReferences(localeRef)
      .catch((error: Error) => {
        toast.danger(error.message);
        return null;
      });
    if (!found) return;
    if (found.length) {
      setWaiting(action);
      setBlockers(found);
      return;
    }
    await run(action);
  };

  const publishAll = async () => {
    setIsPublishingAll(true);
    const fixable = blockers.filter(canPublishFirst);
    for (const blocker of fixable) {
      const published = await referenceStep
        .mutateAsync({
          step: "publish",
          ref: {
            type: blocker.type,
            id: blocker.id,
            language: blocker.publishIn ?? localeRef.language,
          },
        })
        .then(() => true)
        .catch((error: Error) => {
          toast.danger(`${blocker.title}: ${error.message}`);
          return false;
        });
      if (!published) {
        // Those published before the failure are live now: list what still blocks, so a retry
        // starts from the truth rather than re-publishing them
        const remaining = await workflow
          .blockingReferences(localeRef)
          .catch(() => blockers);
        setBlockers(remaining);
        setIsPublishingAll(false);
        return;
      }
    }
    await run(
      waiting,
      undefined,
      `Also published ${fixable.length} ${fixable.length === 1 ? "item" : "items"} it uses`,
    );
    setBlockers([]);
    setIsPublishingAll(false);
  };

  const referencesModal = (
    <PublishReferencesModal
      blockers={blockers}
      isPending={isPublishingAll}
      onClose={() => setBlockers([])}
      onPublishAll={publishAll}
    />
  );

  if (canPublish) {
    if (locale?.status === LocaleStatus.PUBLISHED && !isDirty)
      return (
        <Button isDisabled variant="secondary">
          <CheckCircle className="size-4 text-success" weight="fill" />
          Published
        </Button>
      );
    const approves = locale?.status === LocaleStatus.IN_REVIEW && !isDirty;
    return (
      <>
        <Button
          isDisabled={isBusy || (!locale && !isDirty)}
          onPress={() => goLive(approves ? "approve" : "publish")}
        >
          {approves ? "Approve and publish" : "Publish"}
        </Button>
        {referencesModal}
      </>
    );
  }

  if (isWriter) {
    const canSubmit =
      isDirty || (locale ? SUBMITTABLE.includes(locale.status) : false);
    return (
      <Button
        isDisabled={isBusy || !canSubmit}
        onPress={() => saveThen("submit")}
      >
        {locale?.status === LocaleStatus.IN_REVIEW && !isDirty
          ? "In review"
          : "Submit for review"}
      </Button>
    );
  }

  return null;
}

/**
 * Where this language stands and what else can be done to it: the live and working versions,
 * review notes, translation freshness, unpublishing and history.
 */
export function StatusPanel({
  locale,
  locales,
  localeRef,
  onRestored,
}: {
  /** Undefined until the language has been saved once. */
  locale: LocaleState | undefined;
  /** Every language of the item, to tell whether this one is behind its source. */
  locales: LocaleState[];
  localeRef: LocaleRef;
  onRestored: () => void;
}) {
  const { site } = useActiveSite();
  const { canPublish } = useRoles();
  const { run, isPending } = useRunStep(localeRef);
  const markCurrent = useMarkCurrent();
  const translate = useTranslate();
  const { data: fieldStates } = useTranslationFields(
    localeRef.type,
    localeRef.id,
  );
  const { isDirty, saveAll } = useEditor();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [isConfirmingUnpublish, setIsConfirmingUnpublish] = useState(false);

  if (!locale)
    return (
      <div className="flex flex-col gap-2">
        <StatusChip status={MISSING} />
        <p className="text-muted text-sm">
          Nothing in <span className="font-mono">{localeRef.language}</span>{" "}
          yet. Write it here, or translate it, and save to create it.
        </p>
      </div>
    );

  // Confirms the text as it is on screen, so unsaved fixes are saved before they are confirmed
  const markUpToDate = async () => {
    if (isDirty && !(await saveAll({ quiet: true }))) return;
    markCurrent.mutate(
      { type: localeRef.type, id: localeRef.id, language: localeRef.language },
      { onSuccess: onRestored },
    );
  };

  const behind =
    fieldStates?.find((entry) => entry.languageCode === localeRef.language)
      ?.fields ?? [];
  const namesOf = (state: FieldSyncState) =>
    behind.filter((field) => field.state === state).map((field) => field.name);
  const changed = namesOf("changed");
  const copied = namesOf("copied");
  const edited = namesOf("edited");

  // Translates just this language from the source: the changed fields, and with `replaceEdits`
  // the ones edited here too. Unsaved edits are saved first, as they would be lost to the reload.
  const updateFromSource = async (replaceEdits: boolean) => {
    if (isDirty && !(await saveAll({ quiet: true }))) return;
    translate.mutate(
      {
        type: localeRef.type,
        id: localeRef.id,
        args: {
          languages: [localeRef.language],
          fields: replaceEdits ? edited : undefined,
        },
      },
      {
        onSuccess: (results) => {
          reportTranslation(results);
          onRestored();
        },
        onError: (error) => toast.danger(error.message),
      },
    );
  };

  const isLive = locale.publishedRevision !== null;
  const inReview = locale.status === LocaleStatus.IN_REVIEW;
  const sync = translationState(
    locale,
    locales.find(
      (candidate) => candidate.languageCode === site?.defaultLanguage,
    ),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <StatusChip status={locale.status} />
        <Button
          onPress={() => setIsHistoryOpen(true)}
          size="sm"
          variant="ghost"
        >
          <ClockCounterClockwise className="size-4" />
          History
        </Button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">On the website</dt>
        <dd className="text-end">
          {isLive ? `Version ${locale.publishedRevision}` : "Not live"}
        </dd>
        <dt className="text-muted">Editing</dt>
        <dd className="text-end">Version {locale.revision}</dd>
      </dl>

      {inReview && (
        <Notice
          title={
            isDirty
              ? "Your edits take this out of review"
              : "Waiting for review"
          }
          tone={isDirty ? "warning" : "info"}
        >
          {isDirty
            ? canPublish
              ? "Saving withdraws the submission, and Publish then puts your version live directly, without approving it."
              : "Saving withdraws the submission; submit it again when you're done."
            : `${isLive ? "The live version keeps serving until it is approved. " : ""}Saving an edit takes it out of review.`}
        </Notice>
      )}
      {locale.reviewNote && !inReview && (
        <Notice title="Changes requested" tone="warning">
          {locale.reviewNote}
        </Notice>
      )}
      {sync === "stale" && (
        <Notice
          actions={
            <>
              {changed.length + copied.length > 0 && (
                <Button
                  isDisabled={translate.isPending}
                  onPress={() => updateFromSource(false)}
                  size="sm"
                >
                  {translate.isPending
                    ? "Updating…"
                    : `Update from ${site?.defaultLanguage}`}
                </Button>
              )}
              {edited.length > 0 && (
                <Button
                  isDisabled={translate.isPending}
                  onPress={() => updateFromSource(true)}
                  size="sm"
                  variant="secondary"
                >
                  {changed.length ? "Replace my edits too" : "Replace my edits"}
                </Button>
              )}
              <Button
                isDisabled={markCurrent.isPending}
                onPress={markUpToDate}
                size="sm"
                variant="ghost"
              >
                Mark up to date
              </Button>
            </>
          }
          title={`Behind ${site?.defaultLanguage}`}
          tone="warning"
        >
          <p>
            These changed in {site?.defaultLanguage} since this was translated.
            They're marked on the page.
          </p>
          {changed.length + copied.length > 0 && (
            <p className="mt-1.5">
              <span className="font-medium">To update:</span>{" "}
              {[
                ...changed.map(fieldLabel),
                ...copied.map((name) => `${fieldLabel(name)} (copied as is)`),
              ].join(", ")}
            </p>
          )}
          {edited.length > 0 && (
            <p className="mt-1">
              <span className="font-medium">Edited here, so kept:</span>{" "}
              {edited.map(fieldLabel).join(", ")}
            </p>
          )}
        </Notice>
      )}
      {sync === "untracked" && (
        <Notice
          actions={
            <Button
              isDisabled={markCurrent.isPending}
              onPress={markUpToDate}
              size="sm"
              variant="secondary"
            >
              Mark up to date
            </Button>
          }
          title="Untracked"
        >
          Nothing records which {site?.defaultLanguage} text this was written
          from, so it can't show what's behind. Compare it with{" "}
          {site?.defaultLanguage}, then mark it up to date.
        </Notice>
      )}

      {canPublish && (inReview || isLive) && note === null && (
        <div className="flex flex-wrap gap-2">
          {inReview && (
            <Button
              isDisabled={isPending}
              onPress={() => setNote("")}
              size="sm"
              variant="secondary"
            >
              Request changes
            </Button>
          )}
          {isLive && !isConfirmingUnpublish && (
            <Button
              isDisabled={isPending}
              onPress={() =>
                // What posts show is taken off them too, so that is said first
                REFERENCED_TYPES.includes(localeRef.type)
                  ? setIsConfirmingUnpublish(true)
                  : run("unpublish")
              }
              size="sm"
              variant="ghost"
            >
              Unpublish
            </Button>
          )}
        </div>
      )}

      {isConfirmingUnpublish && (
        <Notice
          actions={
            <>
              <Button
                isDisabled={isPending}
                onPress={async () => {
                  if (await run("unpublish")) setIsConfirmingUnpublish(false);
                }}
                size="sm"
                variant="danger"
              >
                Unpublish
              </Button>
              <Button
                onPress={() => setIsConfirmingUnpublish(false)}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </>
          }
          title={`Unpublish in ${localeRef.language}?`}
          tone="warning"
        >
          <LiveUsageWarning
            consequence={`Unpublishing it in ${localeRef.language}`}
            id={localeRef.id}
            type={localeRef.type}
          />
        </Notice>
      )}

      {note !== null && (
        <div className="flex flex-col gap-2">
          <TextField
            aria-label="What needs changing"
            onChange={setNote}
            value={note}
          >
            <TextArea
              maxLength={REVIEW_NOTE_MAX_LENGTH}
              placeholder="What needs changing before this can go live?"
              rows={3}
            />
          </TextField>
          <div className="flex gap-2">
            <Button
              isDisabled={isPending || !note.trim()}
              onPress={async () => {
                if (await run("requestChanges", note)) setNote(null);
              }}
              size="sm"
            >
              Send back
            </Button>
            <Button onPress={() => setNote(null)} size="sm" variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      )}

      <VersionHistoryModal
        isOpen={isHistoryOpen}
        localeRef={localeRef}
        onClose={() => setIsHistoryOpen(false)}
        onRestored={onRestored}
      />
    </div>
  );
}
