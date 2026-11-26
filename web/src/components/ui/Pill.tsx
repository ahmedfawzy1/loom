import { cn } from "@heroui/react";
import type { ReactNode } from "react";

export type PillTone =
  | "neutral"
  | "accent"
  | "review"
  | "success"
  | "warning"
  | "danger";

const TONES: Record<PillTone, { pill: string; dot: string }> = {
  neutral: { pill: "bg-surface-tertiary text-muted", dot: "bg-muted/60" },
  accent: {
    pill: "bg-accent-soft text-accent-soft-foreground",
    dot: "bg-accent",
  },
  review: { pill: "bg-review-soft text-review", dot: "bg-review" },
  success: {
    pill: "bg-success-soft text-success-soft-foreground",
    dot: "bg-success",
  },
  warning: {
    pill: "bg-warning-soft text-warning-soft-foreground",
    dot: "bg-warning",
  },
  danger: {
    pill: "bg-danger-soft text-danger-soft-foreground",
    dot: "bg-danger",
  },
};

/** A short state label. The dot carries the tone for anyone reading a list at a glance. */
export function Pill({
  tone = "neutral",
  dot = true,
  title,
  children,
}: {
  tone?: PillTone;
  dot?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 font-medium text-[11px]",
        TONES[tone].pill,
      )}
      title={title}
    >
      {dot && <span className={cn("size-1.5 rounded-full", TONES[tone].dot)} />}
      {children}
    </span>
  );
}
