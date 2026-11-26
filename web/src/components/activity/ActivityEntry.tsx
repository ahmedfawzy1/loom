import type { ActivityEntryResponseDto } from "@loom/dto";
import { CONTENT_TYPE_LABELS } from "@loom/dto/constants";
import { AUDIT_ACTION_LABELS } from "@loom-web/src/constants/audit";
import { contentHref } from "@loom-web/src/lib/content/content-href";
import { formatDateTime, formatRelative } from "@loom-web/src/lib/format/date";
import Link from "next/link";

type Entry = Serialized<ActivityEntryResponseDto>;

/** A name the entry itself carries, for things that are not content — an image, a key, a Space. */
const named = (metadata: Entry["metadata"]) => {
  const fields = (metadata ?? {}) as Record<string, unknown>;
  const name = fields.filename ?? fields.name ?? fields.to;
  return typeof name === "string" ? name : null;
};

/** One line of the log: who did what, to which item, in which language and Space, and when. */
export function ActivityEntry({
  entry,
  showSpace,
}: {
  entry: Entry;
  showSpace: boolean;
}) {
  const note = (entry.metadata as Record<string, unknown> | null)?.note;

  return (
    <li className="flex gap-3 py-3">
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-tertiary font-medium text-muted text-xs uppercase"
      >
        {entry.userEmail.charAt(0)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm leading-6">
          <span className="font-medium">{entry.userEmail}</span>{" "}
          <span className="text-muted">
            {AUDIT_ACTION_LABELS[entry.action]}
          </span>{" "}
          {entry.contentType && entry.contentId && (
            <>
              <span className="text-muted">
                {CONTENT_TYPE_LABELS[entry.contentType].toLowerCase()}
              </span>{" "}
              {entry.contentTitle ? (
                <Link
                  className="font-medium hover:text-accent"
                  href={contentHref(entry.contentType, entry.contentId)}
                >
                  {entry.contentTitle}
                </Link>
              ) : (
                <span className="text-muted italic">since deleted</span>
              )}
            </>
          )}
          {!entry.contentType && named(entry.metadata) && (
            <span className="font-medium">{named(entry.metadata)}</span>
          )}
          {entry.languageCode && (
            <span className="ms-1.5 rounded bg-surface-tertiary px-1 py-0.5 font-mono text-[11px] text-muted">
              {entry.languageCode}
            </span>
          )}
        </p>
        {typeof note === "string" && (
          <p className="rounded-md bg-surface-secondary px-2.5 py-1.5 text-[13px]">
            {note}
          </p>
        )}
        {showSpace && entry.spaceName && (
          <p className="text-muted text-xs">{entry.spaceName}</p>
        )}
      </div>
      <time
        className="shrink-0 pt-0.5 text-muted text-xs"
        dateTime={entry.createdAt}
        title={formatDateTime(entry.createdAt)}
      >
        {formatRelative(entry.createdAt)}
      </time>
    </li>
  );
}
