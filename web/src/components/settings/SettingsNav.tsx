"use client";

import { cn } from "@heroui/react";
import {
  isNavItemVisible,
  SETTINGS_NAVIGATION,
} from "@loom-web/src/constants/navigation";
import { useCurrentUser } from "@loom-web/src/hooks/user/useCurrentUser";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** The settings pages as tabs across the top, so each page has the full width below. */
export function SettingsNav() {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  return (
    <nav
      aria-label="Settings"
      className="-mt-2 flex gap-1 overflow-x-auto border-border border-b"
    >
      {SETTINGS_NAVIGATION.filter((item) =>
        isNavItemVisible(item, user?.role),
      ).map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const ItemIcon = item.icon;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-muted text-sm transition-colors duration-fast hover:text-foreground",
              active && "border-accent font-medium text-foreground",
            )}
            data-nav
            href={item.href}
            key={item.href}
          >
            <ItemIcon
              className={cn("size-4 shrink-0", active && "text-accent")}
              weight={active ? "fill" : "regular"}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
