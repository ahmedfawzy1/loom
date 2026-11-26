import type { ReactNode } from "react";

/** The one sheet a sign-in page shows: what this is, and what to do. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-xl tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted text-sm leading-6">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}
