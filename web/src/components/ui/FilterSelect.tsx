"use client";

import { cn, ListBox, Select } from "@heroui/react";

const ANY = "any";

export interface FilterOption {
  id: string;
  label: string;
}

/** One filter of a list: a choice among `options`, or none — the "any" entry, first. */
export function FilterSelect({
  label,
  anyLabel,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  anyLabel: string;
  options: FilterOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  className?: string;
}) {
  return (
    <Select
      aria-label={label}
      className={cn("min-w-40", className)}
      onChange={(key) => {
        const selected = Array.isArray(key) ? key[0] : key;
        if (selected === null || selected === undefined) return;
        onChange(selected === ANY ? undefined : String(selected));
      }}
      value={value ?? ANY}
    >
      <Select.Trigger
        className={cn(
          "h-8 min-h-8 items-center py-0",
          value !== undefined && "border-accent/40 bg-accent-soft/60",
        )}
      >
        <Select.Value className="truncate text-sm" />
        <Select.Indicator className="text-muted" />
      </Select.Trigger>
      <Select.Popover className="max-h-80 min-w-48">
        <ListBox>
          <ListBox.Item id={ANY} textValue={anyLabel}>
            {anyLabel}
          </ListBox.Item>
          {options.map((option) => (
            <ListBox.Item
              id={option.id}
              key={option.id}
              textValue={option.label}
            >
              {option.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
