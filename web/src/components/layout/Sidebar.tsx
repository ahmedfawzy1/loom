"use client";

import { cn, Dropdown, Label, toast } from "@heroui/react";
import { CmsRole, LocaleStatus } from "@loom/dto/models";
import { SpaceSwitcher } from "@loom-web/src/components/layout/SpaceSwitcher";
import {
  isNavItemVisible,
  NAVIGATION,
  type NavItem,
  navItemFor,
} from "@loom-web/src/constants/navigation";
import { ROLE_NAMES } from "@loom-web/src/constants/roles";
import { useReviewQueue } from "@loom-web/src/hooks/content/useWorkflow";
import { useCurrentUser } from "@loom-web/src/hooks/user/useCurrentUser";
import { useSignOut } from "@loom-web/src/hooks/user/useSession";
import { useContextStore } from "@loom-web/src/stores/context";
import { confirmDiscard } from "@loom-web/src/stores/unsaved";
import { CaretUpDown, SignOut, UserGear } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/** How many languages wait for a reviewer — only reviewers see the count. */
function useReviewCount(enabled: boolean) {
  const spaceId = useContextStore((state) => state.spaceId);
  const { data: items } = useReviewQueue(enabled ? spaceId : null);
  return (items ?? []).filter((item) => item.status === LocaleStatus.IN_REVIEW)
    .length;
}

function SidebarLink({
  item,
  active,
  count,
}: {
  item: NavItem;
  active: boolean;
  count?: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-fast",
        active
          ? "bg-surface font-medium text-foreground shadow-[0_0_0_1px_var(--border)]"
          : "text-muted hover:bg-surface-tertiary/60 hover:text-foreground",
      )}
      data-nav
      href={item.href}
    >
      <Icon
        className={cn("size-4 shrink-0", active && "text-accent")}
        weight={active ? "fill" : "regular"}
      />
      <span className="truncate">{item.label}</span>
      {Boolean(count) && (
        <span className="ms-auto rounded-full bg-review-soft px-1.5 font-medium text-[11px] text-review tabular-nums leading-5">
          {count}
        </span>
      )}
    </Link>
  );
}

const ACCOUNT_SETTINGS_HREF = "/settings/account";

/** Who is signed in, with their way to their own settings and out. */
function Account() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const signOut = useSignOut();
  if (!user) return null;
  const name = user.name ?? user.email;

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={`Your account: ${name}`}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-start transition-colors duration-fast hover:bg-surface-tertiary/60 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus"
      >
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-soft-foreground text-xs uppercase"
        >
          {name.charAt(0)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-xs">{name}</span>
          <span className="truncate text-[11px] text-muted">
            {ROLE_NAMES[user.role]}
          </span>
        </span>
        <CaretUpDown className="size-4 shrink-0 text-muted" />
      </Dropdown.Trigger>
      <Dropdown.Popover className="min-w-56" placement="top start">
        <Dropdown.Menu
          aria-label="Your account"
          onAction={(key) => {
            if (!confirmDiscard()) return;
            if (key === "account") router.push(ACCOUNT_SETTINGS_HREF);
            if (key === "sign-out")
              signOut.mutate(undefined, {
                onError: (error) => toast.danger(error.message),
              });
          }}
        >
          <Dropdown.Item id="account" textValue="Account settings">
            <UserGear className="size-4 text-muted" />
            <Label>Account settings</Label>
          </Dropdown.Item>
          <Dropdown.Item id="sign-out" textValue="Sign out">
            <SignOut className="size-4 text-muted" />
            <Label>Sign out</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const active = navItemFor(pathname);
  const reviewCount = useReviewCount(
    user?.role === CmsRole.ADMIN || user?.role === CmsRole.AUTHOR,
  );

  return (
    <nav className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-5 border-border border-r bg-sidebar px-3 py-3">
      <SpaceSwitcher />

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {NAVIGATION.map((section) => {
          const items = section.items.filter((item) =>
            isNavItemVisible(item, user?.role),
          );
          if (!items.length) return null;

          return (
            <div
              className="flex flex-col gap-0.5"
              key={section.label ?? items[0]?.href}
            >
              {section.label && (
                <span className="px-2.5 pb-1 font-medium text-[11px] text-muted">
                  {section.label}
                </span>
              )}
              {items.map((item) => (
                <SidebarLink
                  active={
                    active?.href === item.href ||
                    // Every settings page lights the one Settings entry
                    (item.href === "/settings" &&
                      pathname.startsWith("/settings"))
                  }
                  count={item.href === "/review" ? reviewCount : undefined}
                  item={item}
                  key={item.href}
                />
              ))}
            </div>
          );
        })}
      </div>

      <Account />
    </nav>
  );
}
