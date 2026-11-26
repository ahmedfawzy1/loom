"use client";

import { CONTENT_TYPE_LABELS } from "@loom/dto/constants";
import { CmsRole } from "@loom/dto/models";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { LoadingRows } from "@loom-web/src/components/ui/LoadingRows";
import { StatusChip } from "@loom-web/src/components/ui/StatusChip";
import { useReviewQueue } from "@loom-web/src/hooks/content/useWorkflow";
import { useCurrentUser } from "@loom-web/src/hooks/user/useCurrentUser";
import { contentHref } from "@loom-web/src/lib/content/content-href";
import { formatDateTime, formatRelative } from "@loom-web/src/lib/format/date";
import { useContextStore } from "@loom-web/src/stores/context";
import { Tray } from "@phosphor-icons/react";
import Link from "next/link";

/**
 * Reviewers see everything In Review, oldest first. A Writer sees their own submissions and what
 * happened to each — including the note when changes were requested.
 */
export function ReviewQueue({ limit }: { limit?: number }) {
  const spaceId = useContextStore((state) => state.spaceId);
  const setLanguage = useContextStore((state) => state.setLanguage);
  const { data: user } = useCurrentUser();
  const { data: items, isPending, error } = useReviewQueue(spaceId);
  const isWriter = user?.role === CmsRole.WRITER;

  if (!spaceId || isPending) return <LoadingRows rows={3} />;
  if (error) return <ErrorText message={error.message} />;
  if (items.length === 0)
    return (
      <EmptyState icon={Tray} title="All clear">
        {isWriter
          ? "You haven't submitted anything for review yet."
          : "Nothing is waiting for review."}
      </EmptyState>
    );

  return (
    <ul className="divide-y divide-separator">
      {items.slice(0, limit).map((item) => (
        <li
          className="flex items-start gap-3 py-3"
          key={`${item.type}:${item.id}:${item.languageCode}`}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                className="truncate font-medium text-sm hover:text-accent"
                // Opens the editor on the language that was submitted, not whichever one is selected
                href={contentHref(item.type, item.id)}
                onClick={() => setLanguage(item.languageCode)}
              >
                {item.title}
              </Link>
              <span className="shrink-0 rounded bg-surface-tertiary px-1 py-0.5 font-mono text-[11px] text-muted">
                {item.languageCode}
              </span>
            </div>
            <span className="text-muted text-xs">
              {CONTENT_TYPE_LABELS[item.type]}
              {item.submittedAt && (
                <>
                  {" · submitted "}
                  <span title={formatDateTime(item.submittedAt)}>
                    {formatRelative(item.submittedAt)}
                  </span>
                </>
              )}
              {!isWriter &&
                item.submittedBy &&
                ` by ${item.submittedBy.name ?? item.submittedBy.email}`}
            </span>
            {item.reviewNote && (
              <p className="rounded-md bg-warning-soft px-2.5 py-1.5 text-[13px] text-warning-soft-foreground">
                Changes requested: {item.reviewNote}
              </p>
            )}
          </div>
          <StatusChip status={item.status} />
        </li>
      ))}
    </ul>
  );
}
