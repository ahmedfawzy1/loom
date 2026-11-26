"use client";

import { Button } from "@heroui/react";
import type { ContentListResponseDto } from "@loom/dto";
import { CONTENT_TYPE_PATHS } from "@loom/dto/constants";
import type { CmsContentType } from "@loom/dto/models";
import { ContentBulkBar } from "@loom-web/src/components/content/ContentBulkBar";
import {
  ContentFilterBar,
  type FilterDef,
} from "@loom-web/src/components/content/ContentFilterBar";
import { ContentTable } from "@loom-web/src/components/content/ContentTable";
import { PageHeader } from "@loom-web/src/components/ui/PageHeader";
import type { ContentListState } from "@loom-web/src/hooks/content/useContentListState";
import type { ApiError } from "@loom-web/src/lib/api";
import { type Icon, Plus } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

/**
 * A content section's list: its header and create action, search and filters, the
 * table, and the bulk actions over what is selected on it. Each type supplies its own data and
 * wording.
 */
export function ContentList({
  type,
  state,
  data,
  isPending,
  error,
  title,
  description,
  createLabel,
  searchPlaceholder,
  empty,
  filters,
}: {
  type: CmsContentType;
  state: ContentListState;
  data: Serialized<ContentListResponseDto> | undefined;
  isPending: boolean;
  error: ApiError | null;
  title: string;
  description: string;
  createLabel: string;
  searchPlaceholder: string;
  empty: { icon: Icon; title: string; text: string };
  /** Filters only this type has. */
  filters?: FilterDef[];
}) {
  const router = useRouter();
  const basePath = `/${CONTENT_TYPE_PATHS[type]}`;
  const isFiltered = Boolean(
    state.search ||
      state.status ||
      Object.values(state.filters).some((value) => value !== undefined),
  );
  const create = (
    <Button onPress={() => router.push(`${basePath}/new`)}>
      <Plus className="size-4" weight="bold" />
      {createLabel}
    </Button>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader actions={create} description={description} title={title} />
      <ContentFilterBar
        filters={filters}
        searchPlaceholder={searchPlaceholder}
        state={state}
        total={data?.pagination.total}
      />
      <ContentBulkBar
        language={state.language}
        onDone={state.clearSelection}
        rows={(data?.items ?? []).filter((row) => state.selected.has(row.id))}
        type={type}
      />
      <ContentTable
        basePath={basePath}
        data={data}
        direction={state.direction}
        empty={
          isFiltered
            ? {
                icon: empty.icon,
                title: "Nothing matches",
                text: "No item fits this search and these filters. Clear some to see more.",
              }
            : { ...empty, action: create }
        }
        error={error}
        isPending={isPending || !state.spaceId}
        language={state.language}
        onPageChange={state.setPage}
        onSortChange={state.changeSort}
        selection={{
          selected: state.selected,
          onToggle: state.toggle,
          onToggleAll: state.toggleAll,
        }}
        sort={state.sort}
      />
    </div>
  );
}
