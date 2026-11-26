import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

/** What belongs here, and the way to put the first one in. */
export function EmptyState({
  icon: EmptyIcon,
  title,
  children,
  action,
}: {
  icon: Icon;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-tertiary text-muted">
        <EmptyIcon className="size-5" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-medium text-sm">{title}</p>
        {children && <p className="text-muted text-sm">{children}</p>}
      </div>
      {action}
    </div>
  );
}
