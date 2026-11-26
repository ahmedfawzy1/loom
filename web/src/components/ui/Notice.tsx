import { cn } from "@heroui/react";
import type { Icon } from "@phosphor-icons/react";
import { Info, Warning, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

type NoticeTone = "info" | "warning" | "danger";

const TONES: Record<NoticeTone, { box: string; icon: Icon }> = {
  info: {
    box: "bg-accent-soft/70 text-foreground [&>svg]:text-accent",
    icon: Info,
  },
  warning: {
    box: "bg-warning-soft text-warning-soft-foreground",
    icon: Warning,
  },
  danger: {
    box: "bg-danger-soft text-danger-soft-foreground",
    icon: WarningOctagon,
  },
};

/** Something the reader should know before acting, tinted by how much it matters. */
export function Notice({
  tone = "info",
  title,
  actions,
  className,
  children,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const NoticeIcon = TONES[tone].icon;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm",
        TONES[tone].box,
        className,
      )}
      role={tone === "info" ? "note" : "alert"}
    >
      <NoticeIcon className="mt-0.5 size-4 shrink-0" weight="fill" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-[13px] leading-5">{children}</div>}
        {actions && (
          <div className="mt-1.5 flex flex-wrap gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
