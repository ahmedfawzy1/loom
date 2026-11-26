"use client";

import { Label, ListBox, Select } from "@heroui/react";

const NONE = "none";

/** A pick of one item from the Space — an author, a category — or, when allowed, none of them. */
export function ReferenceSelect({
  label,
  value,
  onChange,
  options,
  allowNone,
  placeholder = "None",
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: { id: string; title: string }[];
  allowNone?: boolean;
  placeholder?: string;
}) {
  return (
    <Select
      className="flex flex-col gap-1.5"
      onChange={(key) => {
        const selected = Array.isArray(key) ? key[0] : key;
        if (selected === null || selected === undefined) return;
        onChange(selected === NONE ? null : String(selected));
      }}
      placeholder={placeholder}
      value={value ?? (allowNone ? NONE : null)}
    >
      <Label className="font-medium text-[13px]">{label}</Label>
      <Select.Trigger>
        <Select.Value className="truncate text-sm" />
        <Select.Indicator className="text-muted" />
      </Select.Trigger>
      <Select.Popover className="max-h-80">
        <ListBox>
          {allowNone ? (
            <ListBox.Item id={NONE} textValue="None">
              <span className="text-muted">None</span>
            </ListBox.Item>
          ) : null}
          {options.map((option) => (
            <ListBox.Item
              id={option.id}
              key={option.id}
              textValue={option.title}
            >
              {option.title}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
