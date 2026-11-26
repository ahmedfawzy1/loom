import { cn } from "@heroui/react";
import type { ReactNode } from "react";

/**
 * A titled block of a page: a white sheet on the paper background. Sections sit side by side or
 * stacked — never inside one another.
 */
export function Section({
  title,
  description,
  actions,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-border bg-surface",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title && <h2 className="font-semibold text-sm">{title}</h2>}
            {description && (
              <p className="text-muted text-xs leading-5">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      <div className={cn("flex flex-col gap-4 px-5 pt-4 pb-5", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
