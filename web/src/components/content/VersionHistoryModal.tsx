"use client";

import { Button, cn, Modal, Skeleton } from "@heroui/react";
import type { BlogVersion } from "@loom/dto/models";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { LoadingRows } from "@loom-web/src/components/ui/LoadingRows";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { Pill } from "@loom-web/src/components/ui/Pill";
import {
  useRestoreVersion,
  useVersion,
  useVersions,
} from "@loom-web/src/hooks/content/useWorkflow";
import type { LocaleRef } from "@loom-web/src/lib/api/workflow";
import { formatDateTime, formatRelative } from "@loom-web/src/lib/format/date";
import {
  ArrowCounterClockwise,
  ClockCounterClockwise,
} from "@phosphor-icons/react";
import { useState } from "react";

// The editor shows these as prose; the preview only needs to say they are there
const STRUCTURED_FIELDS = new Set(["body", "faq", "canonical", "items"]);

const PREVIEW_PLACEHOLDERS = ["a", "b", "c", "d"];

/** The text fields a version holds, enough to recognise it before restoring. */
function VersionPreview({
  localeRef,
  revision,
}: {
  localeRef: LocaleRef;
  revision: BlogVersion["revision"];
}) {
  const { data, isPending, error } = useVersion(localeRef, revision);

  if (isPending)
    return (
      <div aria-busy className="flex flex-col gap-4">
        {PREVIEW_PLACEHOLDERS.map((key) => (
          <div className="flex flex-col gap-1.5" key={key}>
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-3.5 w-4/5 rounded" />
          </div>
        ))}
      </div>
    );
  if (error) return <ErrorText message={error.message} />;

  const snapshot = (data.snapshot ?? {}) as Record<string, unknown>;
  const fields = Object.entries(snapshot).filter(
    ([key, value]) => !STRUCTURED_FIELDS.has(key) && typeof value === "string",
  );

  if (fields.length === 0)
    return (
      <p className="text-muted text-sm">This version holds no text fields.</p>
    );

  return (
    <dl className="flex flex-col">
      {fields.map(([key, value]) => (
        <div
          className="flex flex-col gap-0.5 border-separator border-b py-2.5 first:pt-0 last:border-b-0"
          key={key}
        >
          <dt className="font-mono text-[11px] text-muted">{key}</dt>
          <dd className="line-clamp-3 text-sm">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A locale's saved versions, newest first. Restoring saves the chosen one again as a new
 * version — nothing is removed — so it lands in the restorer's normal state and still needs
 * publishing.
 */
export function VersionHistoryModal({
  isOpen,
  onClose,
  localeRef,
  onRestored,
}: {
  isOpen: boolean;
  onClose: () => void;
  localeRef: LocaleRef;
  onRestored: () => void;
}) {
  const { data: versions, isPending, error } = useVersions(localeRef, isOpen);
  const restore = useRestoreVersion();
  const [selected, setSelected] = useState<BlogVersion["revision"] | null>(
    null,
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const current = versions?.find((version) => version.isCurrent);
  const canRestore =
    selected !== null && selected !== current?.revision && !restore.isPending;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container className="w-full" placement="center">
        <Modal.Dialog className="max-w-3xl rounded-xl p-0">
          <Modal.CloseTrigger />
          <Modal.Header className="border-border border-b px-5 py-4">
            <Modal.Heading className="font-semibold text-base">
              Version history
              <span className="ms-2 font-mono font-normal text-muted text-sm">
                {localeRef.language}
              </span>
            </Modal.Heading>
            <p className="text-muted text-sm">
              Restoring saves a version again as the newest one. Nothing is
              lost.
            </p>
          </Modal.Header>

          <Modal.Body className="grid h-[60vh] grid-cols-[17rem_1fr] p-0">
            <div className="flex flex-col gap-0.5 overflow-y-auto border-border border-e p-2">
              {isPending && <LoadingRows rows={5} />}
              {error && (
                <div className="p-2">
                  <ErrorText message={error.message} />
                </div>
              )}
              {versions?.map((version) => (
                <button
                  className={cn(
                    "flex flex-col gap-1 rounded-lg px-3 py-2 text-start transition-colors duration-fast hover:bg-surface-secondary",
                    version.revision === selected &&
                      "bg-accent-soft hover:bg-accent-soft",
                  )}
                  data-row
                  key={version.revision}
                  onClick={() => {
                    setSelected(version.revision);
                    setIsConfirming(false);
                  }}
                  type="button"
                >
                  <span
                    className={cn(
                      "flex items-center gap-1.5 font-medium text-sm",
                      version.revision === selected &&
                        "text-accent-soft-foreground",
                    )}
                  >
                    Version {version.revision}
                    {version.isPublished && <Pill tone="success">Live</Pill>}
                    {version.isCurrent && <Pill>Current</Pill>}
                  </span>
                  <span className="truncate text-muted text-xs">
                    <time
                      dateTime={version.createdAt}
                      title={formatDateTime(version.createdAt)}
                    >
                      {formatRelative(version.createdAt)}
                    </time>
                    {version.createdBy &&
                      ` · ${version.createdBy.name ?? version.createdBy.email}`}
                  </span>
                  {version.note && (
                    <span className="line-clamp-2 text-muted text-xs italic">
                      {version.note}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto px-5 py-4">
              {selected === null ? (
                <EmptyState icon={ClockCounterClockwise} title="Pick a version">
                  Choose a version on the left to see what it held.
                </EmptyState>
              ) : (
                <VersionPreview localeRef={localeRef} revision={selected} />
              )}
            </div>
          </Modal.Body>

          <Modal.Footer className="flex-col items-stretch gap-3 border-border border-t px-5 py-3">
            {restore.error && <ErrorText message={restore.error.message} />}
            {isConfirming && selected !== null ? (
              <Notice
                actions={
                  <>
                    <Button
                      isDisabled={!canRestore}
                      onPress={() =>
                        restore.mutate(
                          { ref: localeRef, revision: selected },
                          {
                            onSuccess: () => {
                              setSelected(null);
                              setIsConfirming(false);
                              onClose();
                              onRestored();
                            },
                          },
                        )
                      }
                      size="sm"
                    >
                      {restore.isPending
                        ? "Restoring…"
                        : `Restore version ${selected}`}
                    </Button>
                    <Button
                      onPress={() => setIsConfirming(false)}
                      size="sm"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </>
                }
                title={`Restore version ${selected}?`}
                tone="warning"
              >
                It's saved as a new version of {localeRef.language}. Publish it
                to make it live.
              </Notice>
            ) : (
              <div className="flex justify-end gap-2">
                <Button onPress={onClose} variant="secondary">
                  Close
                </Button>
                <Button
                  isDisabled={!canRestore}
                  onPress={() => setIsConfirming(true)}
                >
                  <ArrowCounterClockwise className="size-4" />
                  {selected === null
                    ? "Restore"
                    : `Restore version ${selected}`}
                </Button>
              </div>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
