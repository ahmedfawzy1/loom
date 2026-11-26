"use client";

import { Button } from "@heroui/react";
import type { ActivityEntryResponseDto } from "@loom/dto";
import { CONTENT_TYPE_LABELS } from "@loom/dto/constants";
import { AuditAction, CmsContentType } from "@loom/dto/models";
import { ActivityEntry } from "@loom-web/src/components/activity/ActivityEntry";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { FilterSelect } from "@loom-web/src/components/ui/FilterSelect";
import { LoadingRows } from "@loom-web/src/components/ui/LoadingRows";
import { PageHeader } from "@loom-web/src/components/ui/PageHeader";
import { Segmented } from "@loom-web/src/components/ui/Segmented";
import { AUDIT_ACTION_LABELS } from "@loom-web/src/constants/audit";
import { DAY_MS } from "@loom-web/src/constants/time.constants";
import { useActivity } from "@loom-web/src/hooks/activity/useActivity";
import { useDirectory } from "@loom-web/src/hooks/user/useUserQueries";
import { formatDate } from "@loom-web/src/lib/format/date";
import { useContextStore } from "@loom-web/src/stores/context";
import { ClockCounterClockwise } from "@phosphor-icons/react";
import { useState } from "react";

type Entry = Serialized<ActivityEntryResponseDto>;

const WITHIN = [
  { id: "1", label: "Today" },
  { id: "7", label: "This week" },
  { id: "30", label: "This month" },
];

const dayOf = (value: string) => new Date(value).toDateString();

const dayLabel = (value: string) => {
  const day = dayOf(value);
  if (day === new Date().toDateString()) return "Today";
  if (day === new Date(Date.now() - DAY_MS).toDateString()) return "Yesterday";
  return formatDate(value);
};

/** Consecutive entries grouped under the day they happened, newest day first. */
const byDay = (entries: Entry[]) =>
  entries.reduce<{ day: string; entries: Entry[] }[]>((groups, entry) => {
    const last = groups.at(-1);
    if (
      last &&
      dayOf(last.entries[0]?.createdAt ?? "") === dayOf(entry.createdAt)
    )
      last.entries.push(entry);
    else groups.push({ day: dayLabel(entry.createdAt), entries: [entry] });
    return groups;
  }, []);

/**
 * The Activity log: every recorded action, newest first, kept forever. It opens on the
 * selected Space; everything includes what belongs to no Space — users, Sites, settings.
 */
export function ActivityLog() {
  const spaceId = useContextStore((state) => state.spaceId);
  const language = useContextStore((state) => state.languageCode);
  const { data: people } = useDirectory();

  const [scope, setScope] = useState<"space" | "all">("space");
  const [userId, setUserId] = useState<string>();
  const [action, setAction] = useState<AuditAction>();
  const [contentType, setContentType] = useState<CmsContentType>();
  const [within, setWithin] = useState<string>();
  const [from, setFrom] = useState<string>();
  const [page, setPage] = useState(1);

  const { data, isPending, error } = useActivity({
    spaceId: scope === "space" ? (spaceId ?? undefined) : undefined,
    language,
    userId,
    action,
    contentType,
    from,
    page,
  });

  // Every filter starts the log again from its newest entry
  const filter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  const body = () => {
    if (isPending) return <LoadingRows rows={8} />;
    if (error)
      return (
        <div className="px-5 py-6">
          <ErrorText message={error.message} />
        </div>
      );
    if (data.items.length === 0)
      return (
        <EmptyState icon={ClockCounterClockwise} title="Nothing recorded">
          No activity matches these filters.
        </EmptyState>
      );

    return byDay(data.items).map((group) => (
      <section key={`${group.day}:${group.entries[0]?.id}`}>
        <h2 className="sticky top-13 z-10 border-border border-y bg-surface-secondary px-5 py-1.5 font-medium text-muted text-xs first:border-t-0">
          {group.day}
        </h2>
        <ul className="divide-y divide-separator px-5">
          {group.entries.map((entry) => (
            <ActivityEntry
              entry={entry}
              key={entry.id}
              showSpace={scope !== "space"}
            />
          ))}
        </ul>
      </section>
    ));
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        description="Who changed what, in which language and Space. Kept forever."
        title="Activity"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented<"space" | "all">
          label="Which Space"
          onChange={filter(setScope)}
          options={[
            { id: "space", label: "This Space" },
            { id: "all", label: "Everything" },
          ]}
          value={scope}
        />
        <FilterSelect
          anyLabel="Anyone"
          label="Filter by person"
          onChange={filter(setUserId)}
          options={(people ?? []).map((person) => ({
            id: person.id,
            label: person.name ?? person.email,
          }))}
          value={userId}
        />
        <FilterSelect
          anyLabel="Any action"
          label="Filter by action"
          onChange={filter((value) => setAction(value as AuditAction))}
          options={Object.values(AuditAction).map((value) => ({
            id: value,
            label: AUDIT_ACTION_LABELS[value],
          }))}
          value={action}
        />
        <FilterSelect
          anyLabel="Any type"
          label="Filter by content type"
          onChange={filter((value) => setContentType(value as CmsContentType))}
          options={Object.values(CmsContentType).map((value) => ({
            id: value,
            label: CONTENT_TYPE_LABELS[value],
          }))}
          value={contentType}
        />
        <FilterSelect
          anyLabel="Any time"
          label="Filter by when"
          onChange={filter((days: string | undefined) => {
            setWithin(days);
            setFrom(
              days
                ? new Date(Date.now() - Number(days) * DAY_MS).toISOString()
                : undefined,
            );
          })}
          options={WITHIN}
          value={within}
        />
      </div>

      <div className="overflow-clip rounded-xl border border-border bg-surface">
        {body()}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-border border-t px-5 py-2 text-muted text-xs">
            <span className="tabular-nums">
              {data.pagination.total} entries · page {data.pagination.page} of{" "}
              {data.pagination.totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                isDisabled={page <= 1}
                onPress={() => setPage(page - 1)}
                size="sm"
                variant="ghost"
              >
                Newer
              </Button>
              <Button
                isDisabled={page >= data.pagination.totalPages}
                onPress={() => setPage(page + 1)}
                size="sm"
                variant="ghost"
              >
                Older
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
