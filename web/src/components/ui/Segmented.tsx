import { cn } from "@heroui/react";
import type { ReactNode } from "react";

/** A choice between two or three views of the same thing, shown side by side. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset
      aria-label={label}
      className="flex w-fit rounded-lg bg-surface-tertiary p-0.5"
    >
      {options.map((option) => (
        <button
          aria-pressed={option.id === value}
          className={cn(
            "h-7 rounded-md px-2.5 text-muted text-xs transition-colors duration-fast hover:text-foreground",
            option.id === value &&
              "bg-surface font-medium text-foreground shadow-[0_0_0_1px_var(--border)]",
          )}
          key={option.id}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
