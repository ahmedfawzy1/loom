"use client";

import { Button, Modal } from "@heroui/react";
import type { BlockingReferenceResponseDto } from "@loom/dto";
import { CONTENT_TYPE_LABELS } from "@loom/dto/constants";
import { LocaleStatus } from "@loom/dto/models";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { StatusChip } from "@loom-web/src/components/ui/StatusChip";
import { contentHref } from "@loom-web/src/lib/content/content-href";
import { ArrowSquareOut } from "@phosphor-icons/react";

type Blocker = Serialized<BlockingReferenceResponseDto>;

const CANNOT: Record<Blocker["reason"], string> = {
  missing: "no longer exists. Remove it from this version.",
  trashed: "is in the Trash. Restore it, or remove it from this version.",
  unpublished:
    "has no version in this language to publish. Write or translate it first.",
};

/** A blocker publishing it now would clear. */
export const canPublishFirst = (blocker: Blocker) =>
  blocker.reason === "unpublished" && blocker.publishIn !== null;

/**
 * One item publishing puts live as its working copy stands — a draft, or a submission this approves —
 * so it shows its status and opens in a new tab to be read first, without leaving this editor.
 */
function BlockerRow({ blocker }: { blocker: Blocker }) {
  return (
    <li className="flex items-center gap-2 py-2 text-sm">
      <span className="w-16 shrink-0 text-muted text-xs">
        {CONTENT_TYPE_LABELS[blocker.type]}
      </span>
      <a
        className="flex min-w-0 flex-1 items-center gap-1 font-medium hover:text-accent"
        href={contentHref(blocker.type, blocker.id)}
        rel="noopener"
        target="_blank"
        title="Open in a new tab"
      >
        <span className="truncate">{blocker.title}</span>
        <ArrowSquareOut className="size-3.5 shrink-0 text-muted" />
      </a>
      {blocker.status && <StatusChip status={blocker.status} />}
      <span className="shrink-0 font-mono text-muted text-xs">
        {blocker.publishIn}
      </span>
    </li>
  );
}

/**
 * What this version points at that isn't live yet. The website can't show a post whose byline or
 * category isn't published, so rather than only refusing, this offers to publish them first.
 */
export function PublishReferencesModal({
  blockers,
  isPending,
  onPublishAll,
  onClose,
}: {
  blockers: Blocker[];
  isPending: boolean;
  onPublishAll: () => void;
  onClose: () => void;
}) {
  const fixable = blockers.filter(canPublishFirst);
  const stuck = blockers.filter((blocker) => !canPublishFirst(blocker));

  return (
    <Modal.Backdrop
      isOpen={blockers.length > 0}
      onOpenChange={(open) => !open && onClose()}
    >
      <Modal.Container className="w-full" placement="center">
        <Modal.Dialog className="max-w-md rounded-xl p-0">
          <Modal.CloseTrigger />
          <Modal.Header className="border-border border-b px-5 py-4">
            <Modal.Heading className="font-semibold text-base">
              {stuck.length ? "This can't go live yet" : "Publish these too?"}
            </Modal.Heading>
            <p className="text-muted text-sm">
              It uses content that isn't live, and the website can't show it
              without them.
            </p>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-4 px-5 py-4">
            {fixable.some(
              (blocker) => blocker.status === LocaleStatus.IN_REVIEW,
            ) && (
              <Notice tone="warning">
                Something here is waiting for review. Publishing it approves it,
                so open it and read it first.
              </Notice>
            )}
            {fixable.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="font-medium text-muted text-xs">
                  Published together with it
                </p>
                <ul className="divide-y divide-separator">
                  {fixable.map((blocker) => (
                    <BlockerRow blocker={blocker} key={blocker.id} />
                  ))}
                </ul>
              </div>
            )}
            {stuck.length > 0 && (
              <Notice title="Needs fixing first" tone="warning">
                <ul className="flex flex-col gap-1">
                  {stuck.map((blocker) => (
                    <li key={blocker.id}>
                      {CONTENT_TYPE_LABELS[blocker.type]} “{blocker.title}”{" "}
                      {CANNOT[blocker.reason]}
                    </li>
                  ))}
                </ul>
              </Notice>
            )}
          </Modal.Body>

          <Modal.Footer className="flex justify-end gap-2 border-border border-t px-5 py-4">
            <Button onPress={onClose} variant="ghost">
              Cancel
            </Button>
            {stuck.length === 0 && (
              <Button isDisabled={isPending} onPress={onPublishAll}>
                {isPending
                  ? "Publishing…"
                  : `Publish all ${fixable.length + 1}`}
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
