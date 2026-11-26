import type { ListContentRequestDto, ListSortField } from "@loom/dto";
import type { LocaleStatus } from "@loom/dto/models";
import { useDebounced } from "@loom-web/src/hooks/util/useDebounced";
import { useContextStore } from "@loom-web/src/stores/context";
import { useState } from "react";

/** The filters beyond search and status: who submitted it, when it was edited, and a post's own. */
export type ListFilters = Pick<
  ListContentRequestDto,
  "submittedById" | "updatedFrom" | "categoryId" | "authorId" | "tagId"
>;

/**
 * The query state every content list holds: search, status, filters, sort, page and the selection
 * a bulk action acts on, resolved against the Space and language the context bar is pointed at.
 */
export function useContentListState(initialStatus?: LocaleStatus) {
  const spaceId = useContextStore((state) => state.spaceId);
  const language = useContextStore((state) => state.languageCode);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LocaleStatus | undefined>(initialStatus);
  const [filters, setFilters] = useState<ListFilters>({});
  const [sort, setSort] = useState<ListSortField>("updatedAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const debouncedSearch = useDebounced(search);

  // Changing Space or language can leave the viewer on a page that no longer exists — page 3 of a
  // one-page result renders as "nothing here". This is React's adjust-state-during-render pattern
  // rather than an effect: the reset belongs to the same render as the change that caused it, so
  // the stale page is never queried. A selection from another Space would act on the wrong rows.
  const contextKey = `${spaceId}:${language}`;
  const [lastContextKey, setLastContextKey] = useState(contextKey);
  if (contextKey !== lastContextKey) {
    setLastContextKey(contextKey);
    setPage(1);
    setSelected(new Set());
  }

  const query: ListContentRequestDto = {
    spaceId: spaceId ?? "",
    language,
    q: debouncedSearch || undefined,
    status,
    ...filters,
    sort,
    direction,
    page,
  };

  /** A new result set: back to its first page, and nothing selected that it may not contain. */
  const restart = () => {
    setPage(1);
    setSelected(new Set());
  };

  /** Clicking the active column flips the direction; a new column starts descending. */
  const changeSort = (next: ListSortField) => {
    if (next === sort) {
      setDirection(direction === "asc" ? "desc" : "asc");
      return;
    }
    setSort(next);
    setDirection("desc");
  };

  const changeSearch = (value: string) => {
    setSearch(value);
    restart();
  };

  const changeStatus = (value: LocaleStatus | undefined) => {
    setStatus(value);
    restart();
  };

  const changeFilter = <K extends keyof ListFilters>(
    key: K,
    value: ListFilters[K],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    restart();
  };

  const clearFilters = () => {
    setFilters({});
    restart();
  };

  const changePage = (next: number) => {
    setPage(next);
    setSelected(new Set());
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  /** All of `ids` selected already: clear them; otherwise select them all. */
  const toggleAll = (ids: string[]) =>
    setSelected(ids.every((id) => selected.has(id)) ? new Set() : new Set(ids));

  return {
    query,
    enabled: Boolean(spaceId),
    spaceId,
    language,
    search,
    setSearch: changeSearch,
    status,
    setStatus: changeStatus,
    filters,
    setFilter: changeFilter,
    clearFilters,
    sort,
    direction,
    changeSort,
    setPage: changePage,
    selected,
    toggle,
    toggleAll,
    clearSelection: () => setSelected(new Set()),
  };
}

export type ContentListState = ReturnType<typeof useContentListState>;
