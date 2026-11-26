"use client";

import { GlobalSearch } from "@loom-web/src/components/layout/GlobalSearch";
import { LanguageSwitcher } from "@loom-web/src/components/layout/LanguageSwitcher";
import { NAVIGATION, navItemFor } from "@loom-web/src/constants/navigation";
import { CaretRight } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";

/** Where the page sits — its sidebar group, then its own name — with the working context beside it. */
function Trail() {
  const pathname = usePathname();
  const item = navItemFor(pathname);
  if (!item) return null;

  const section = pathname.startsWith("/settings")
    ? "Settings"
    : NAVIGATION.find((candidate) => candidate.items.includes(item))?.label;

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm">
      {section && (
        <>
          <span className="text-muted">{section}</span>
          <CaretRight className="size-3 text-muted" />
        </>
      )}
      <span className="truncate font-medium">{item.label}</span>
    </div>
  );
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-13 shrink-0 items-center justify-between gap-4 border-border border-b bg-background px-6">
      <Trail />
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <GlobalSearch />
      </div>
    </header>
  );
}
