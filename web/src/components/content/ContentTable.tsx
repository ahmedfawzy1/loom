"use client";

import { Button, Checkbox, cn } from "@heroui/react";
import type { ContentListResponseDto, ListSortField } from "@loom/dto";
import { LocaleStatus, type SiteLanguage } from "@loom/dto/models";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { LoadingRows } from "@loom-web/src/components/ui/LoadingRows";
import { MISSING, StatusChip } from "@loom-web/src/components/ui/StatusChip";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import type { ApiError } from "@loom-web/src/lib/api";
import { formatDateTime, formatRelative } from "@loom-web/src/lib/format/date";
import {
  ArrowDown,
  ArrowUp,
  CaretLeft,
  CaretRight,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";

type Row = Serialized<ContentListResponseDto>["items"][number];

interface ContentTableProps {
  data: Serialized<ContentListResponseDto> | undefined;
  isPending: boolean;
  error: ApiError | null;
  /** Row links point here: `${basePath}/${id}`. */
  basePath: string;
  language: SiteLanguage["code"];
  sort: ListSortField;
  direction: "asc" | "desc";
  onSortChange: (sort: ListSortField) => void;
  onPageChange: (page: number) => void;
  empty: { icon: Icon; title: string; text: string; action?: ReactNode };
  /** Given, each row gets a checkbox — the selection a bulk action acts on. */
  selection?: {
    selected: ReadonlySet<string>;
    onToggle: (id: string) => void;
    onToggleAll: (ids: string[]) => void;
  };
}

function SortButton({
  field,
  label,
  sort,
  direction,
  onSortChange,
}: {
  field: ListSortField;
  label: string;
  sort: ListSortField;
  direction: "asc" | "desc";
  onSortChange: (sort: ListSortField) => void;
}) {
  const active = sort === field;
  const Arrow = direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1 font-medium transition-colors duration-fast hover:text-foreground",
        active && "text-foreground",
      )}
      onClick={() => onSortChange(field)}
      type="button"
    >
      {label}
      {active && <Arrow className="size-3" />}
    </button>
  );
}

/** How many of the Site's languages this item is live in, as a bar and a count. */
function Coverage({ row, total }: { row: Row; total: number }) {
  const live = row.locales.filter(
    (locale) => locale.status === LocaleStatus.PUBLISHED,
  ).length;
  const share = total ? Math.min(live / total, 1) : 0;

  return (
    <div
      className="flex items-center gap-2"
      title={`Live in ${live} of ${total} languages; ${row.locales.length} have a version`}
    >
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-tertiary">
        <div
          className="h-full rounded-full bg-success"
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <span className="text-muted text-xs tabular-nums">
        {live}/{total}
      </span>
    </div>
  );
}

export function ContentTable({
  data,
  isPending,
  error,
  basePath,
  language,
  sort,
  direction,
  onSortChange,
  onPageChange,
  empty,
  selection,
}: ContentTableProps) {
  const { site } = useActiveSite();
  const languageCount =
    site?.languages.filter((candidate) => candidate.enabled).length ?? 0;
  const ids = data?.items.map((row) => row.id) ?? [];
  const allSelected =
    ids.length > 0 && ids.every((id) => selection?.selected.has(id));
  const someSelected = ids.some((id) => selection?.selected.has(id));

  const body = () => {
    if (isPending) return <LoadingRows />;
    if (error)
      return (
        <div className="px-4 py-6">
          <ErrorText message={error.message} />
        </div>
      );
    if (!data?.items.length)
      return (
        <EmptyState action={empty.action} icon={empty.icon} title={empty.title}>
          {empty.text}
        </EmptyState>
      );

    return (
      <table className="w-full text-sm">
        <thead className="border-border border-b text-muted text-xs">
          <tr>
            {selection && (
              <th className="w-11 ps-4">
                <Checkbox
                  aria-label="Select every row on this page"
                  isIndeterminate={someSelected && !allSelected}
                  isSelected={allSelected}
                  onChange={() => selection.onToggleAll(ids)}
                >
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox>
              </th>
            )}
            <th className="px-4 py-2.5 text-start">
              <SortButton
                direction={direction}
                field="title"
                label="Title"
                onSortChange={onSortChange}
                sort={sort}
              />
            </th>
            <th className="w-36 px-4 py-2.5 text-start font-medium">
              Status <span className="font-mono">{language}</span>
            </th>
            <th className="w-40 px-4 py-2.5 text-start font-medium">Live</th>
            <th className="w-40 px-4 py-2.5 text-start">
              <SortButton
                direction={direction}
                field="updatedAt"
                label="Edited"
                onSortChange={onSortChange}
                sort={sort}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((row) => {
            const current = row.locales.find(
              (locale) => locale.languageCode === language,
            );
            const isSelected = selection?.selected.has(row.id) ?? false;
            return (
              <tr
                className={cn(
                  "group border-separator border-b transition-colors duration-fast last:border-b-0 hover:bg-surface-secondary",
                  isSelected && "bg-accent-soft/50 hover:bg-accent-soft/70",
                )}
                key={row.id}
              >
                {selection && (
                  <td className="w-11 ps-4">
                    <Checkbox
                      aria-label={`Select ${row.title}`}
                      isSelected={isSelected}
                      onChange={() => selection.onToggle(row.id)}
                    >
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox>
                  </td>
                )}
                <td className="max-w-0 px-4 py-2.5">
                  <Link
                    className="block truncate font-medium hover:text-accent"
                    href={`${basePath}/${row.id}`}
                  >
                    {row.title}
                  </Link>
                  <div className="flex items-center gap-2 text-muted text-xs">
                    {row.slug && (
                      <span className="truncate font-mono">{row.slug}</span>
                    )}
                    {!row.hasRequestedLocale && (
                      // The title shown is the default language's, so say so rather than implying
                      // this row has been translated
                      <span className="shrink-0">
                        Title from {site?.defaultLanguage}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <StatusChip status={current?.status ?? MISSING} />
                </td>
                <td className="px-4 py-2.5">
                  <Coverage row={row} total={languageCount} />
                </td>
                <td
                  className="px-4 py-2.5 text-muted text-xs"
                  title={formatDateTime(row.updatedAt)}
                >
                  {formatRelative(row.updatedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const pagination = data?.pagination;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {body()}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-border border-t px-4 py-2 text-muted text-xs">
          <span className="tabular-nums">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              aria-label="Previous page"
              isDisabled={pagination.page <= 1}
              isIconOnly
              onPress={() => onPageChange(pagination.page - 1)}
              size="sm"
              variant="ghost"
            >
              <CaretLeft className="size-4" />
            </Button>
            <Button
              aria-label="Next page"
              isDisabled={pagination.page >= pagination.totalPages}
              isIconOnly
              onPress={() => onPageChange(pagination.page + 1)}
              size="sm"
              variant="ghost"
            >
              <CaretRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
