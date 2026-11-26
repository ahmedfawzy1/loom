"use client";

import { Button, Input, Popover, TextField } from "@heroui/react";
import { LocaleStatus } from "@loom/dto/models";
import {
  type FilterOption,
  FilterSelect,
} from "@loom-web/src/components/ui/FilterSelect";
import { statusLabel } from "@loom-web/src/components/ui/StatusChip";
import { DAY_MS } from "@loom-web/src/constants/time.constants";
import type { ContentListState } from "@loom-web/src/hooks/content/useContentListState";
import { useDirectory } from "@loom-web/src/hooks/user/useUserQueries";
import { FunnelSimple, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useState } from "react";

// How recently an item was last edited, in any language
const EDITED_WITHIN = [
  { id: "1", label: "Edited today" },
  { id: "7", label: "Edited this week" },
  { id: "30", label: "Edited this month" },
];

/** One filter behind the Filters button, shown as a removable chip while it is set. */
export interface FilterDef {
  key: string;
  label: string;
  anyLabel: string;
  options: FilterOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

/**
 * Search and filters for a content list. Status and "submitted by" apply to the language
 * in the top bar; "edited" to the item in any language. Status stays in view because it is the
 * filter reached for most; the rest wait behind one button so the row never wraps.
 */
export function ContentFilterBar({
  state,
  searchPlaceholder,
  filters = [],
  total,
}: {
  state: ContentListState;
  searchPlaceholder: string;
  /** Filters only one type has — a post's category, author and tag. */
  filters?: FilterDef[];
  total: number | undefined;
}) {
  const { data: people } = useDirectory();
  // The filter holds a moment; this remembers which choice produced it, to show it selected
  const [editedWithin, setEditedWithin] = useState<string>();

  const defs: FilterDef[] = [
    {
      key: "edited",
      label: "Last edited",
      anyLabel: "Any time",
      options: EDITED_WITHIN,
      value: editedWithin,
      onChange: (days) => {
        setEditedWithin(days);
        state.setFilter(
          "updatedFrom",
          days
            ? new Date(Date.now() - Number(days) * DAY_MS).toISOString()
            : undefined,
        );
      },
    },
    {
      key: "submittedBy",
      label: "Submitted by",
      anyLabel: "Anyone",
      options: (people ?? []).map((person) => ({
        id: person.id,
        label: person.name ?? person.email,
      })),
      value: state.filters.submittedById,
      onChange: (userId) => state.setFilter("submittedById", userId),
    },
    ...filters,
  ];
  const active = defs.filter((def) => def.value !== undefined);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <TextField
          aria-label="Search"
          className="relative w-72"
          onChange={state.setSearch}
          value={state.search}
        >
          <MagnifyingGlass className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            className="h-8 ps-8 text-sm"
            placeholder={searchPlaceholder}
            type="search"
          />
        </TextField>

        <FilterSelect
          anyLabel="Any status"
          className="min-w-36"
          label="Filter by status"
          onChange={(value) =>
            state.setStatus(value as LocaleStatus | undefined)
          }
          options={Object.values(LocaleStatus).map((status) => ({
            id: status,
            label: statusLabel(status),
          }))}
          value={state.status}
        />

        <Popover>
          <Button className="h-8" size="sm" variant="secondary">
            <FunnelSimple className="size-4" />
            Filters
            {active.length > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[11px] text-accent-foreground tabular-nums leading-4">
                {active.length}
              </span>
            )}
          </Button>
          <Popover.Content className="w-72" placement="bottom start">
            <Popover.Dialog className="flex flex-col gap-3 p-3">
              {defs.map((def) => (
                <div className="flex flex-col gap-1" key={def.key}>
                  <span className="font-medium text-muted text-xs">
                    {def.label}
                  </span>
                  <FilterSelect
                    anyLabel={def.anyLabel}
                    className="w-full"
                    label={def.label}
                    onChange={def.onChange}
                    options={def.options}
                    value={def.value}
                  />
                </div>
              ))}
            </Popover.Dialog>
          </Popover.Content>
        </Popover>

        {total !== undefined && (
          <span className="ms-auto text-muted text-xs tabular-nums">
            {total} {total === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {active.map((def) => (
            <span
              className="inline-flex h-6 items-center gap-1 rounded-md bg-accent-soft ps-2 pe-1 text-accent-soft-foreground text-xs"
              key={def.key}
            >
              <span className="text-accent-soft-foreground/70">
                {def.label}:
              </span>
              {def.options.find((option) => option.id === def.value)?.label}
              <button
                aria-label={`Clear ${def.label}`}
                className="rounded p-0.5 hover:bg-accent/10"
                onClick={() => def.onChange(undefined)}
                type="button"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button
            className="px-1.5 text-muted text-xs hover:text-foreground"
            onClick={() => {
              setEditedWithin(undefined);
              state.clearFilters();
            }}
            type="button"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
