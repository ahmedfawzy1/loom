"use client";

import { cn, Kbd, Modal } from "@heroui/react";
import {
  CONTENT_TYPE_LABELS,
  SEARCH_QUERY_MIN_LENGTH,
} from "@loom/dto/constants";
import { CmsContentType } from "@loom/dto/models";
import {
  isNavItemVisible,
  NAVIGATION,
  SETTINGS_NAVIGATION,
} from "@loom-web/src/constants/navigation";
import { useSearch } from "@loom-web/src/hooks/search/useSearch";
import { useCurrentUser } from "@loom-web/src/hooks/user/useCurrentUser";
import { useDebounced } from "@loom-web/src/hooks/util/useDebounced";
import { contentHref } from "@loom-web/src/lib/content/content-href";
import { useContextStore } from "@loom-web/src/stores/context";
import { confirmDiscard } from "@loom-web/src/stores/unsaved";
import {
  Article,
  FolderSimple,
  type Icon,
  MagnifyingGlass,
  Megaphone,
  Star,
  Tag,
  UserCircle,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TYPE_ICONS: Record<CmsContentType, Icon> = {
  [CmsContentType.BLOG]: Article,
  [CmsContentType.CATEGORY]: FolderSimple,
  [CmsContentType.TAG]: Tag,
  [CmsContentType.AUTHOR]: UserCircle,
  [CmsContentType.CTA]: Megaphone,
  [CmsContentType.FEATURED_ARTICLES]: Star,
};

interface Option {
  key: string;
  label: string;
  detail?: string;
  icon: Icon;
  href: string;
  /** Content opens in the language it matched in, not whichever one is selected. */
  language?: string;
}

/**
 * Everything in one box: with nothing typed it jumps to any screen; typed, it searches
 * every post, category, tag, author and CTA of the Space in every language. ⌘K or / opens it.
 */
export function GlobalSearch() {
  const router = useRouter();
  const spaceId = useContextStore((state) => state.spaceId);
  const language = useContextStore((state) => state.languageCode);
  const setLanguage = useContextStore((state) => state.setLanguage);
  const { data: user } = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const debounced = useDebounced(q.trim());
  const isSearching = debounced.length >= SEARCH_QUERY_MIN_LENGTH;
  const { data: results, isFetching } = useSearch({
    spaceId: spaceId ?? "",
    language,
    q: debounced,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
      if (
        (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" && !isTyping)
      ) {
        event.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const screens: Option[] = [
    ...NAVIGATION.flatMap((section) => section.items),
    ...SETTINGS_NAVIGATION,
  ]
    .filter(
      (item) => item.href !== "/settings" && isNavItemVisible(item, user?.role),
    )
    .filter((item) => item.label.toLowerCase().includes(q.trim().toLowerCase()))
    .map((item) => ({
      key: item.href,
      label: item.label,
      icon: item.icon,
      href: item.href,
    }));

  const matches: Option[] = (results ?? []).map((result) => ({
    key: `${result.type}:${result.id}`,
    label: result.title,
    detail: [
      CONTENT_TYPE_LABELS[result.type],
      result.languageCode !== language ? result.languageCode : null,
    ]
      .filter(Boolean)
      .join(" · "),
    icon: TYPE_ICONS[result.type],
    href: contentHref(result.type, result.id),
    language: result.languageCode,
  }));

  const options = isSearching ? [...matches, ...screens] : screens;
  const active = Math.min(cursor, Math.max(options.length - 1, 0));

  const close = () => {
    setIsOpen(false);
    setQ("");
    setCursor(0);
  };

  const open = (option: Option) => {
    if (!confirmDiscard()) return;
    if (option.language) setLanguage(option.language);
    router.push(option.href);
    close();
  };

  return (
    <>
      <button
        className="flex h-8 w-64 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-muted text-sm transition-colors duration-fast hover:bg-surface-secondary"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <MagnifyingGlass className="size-4" />
        <span className="flex-1 text-start">Search or jump to…</span>
        <Kbd className="text-[11px]">
          <Kbd.Abbr keyValue="command" />
          <Kbd.Content>K</Kbd.Content>
        </Kbd>
      </button>

      <Modal.Backdrop isOpen={isOpen} onOpenChange={(next) => !next && close()}>
        <Modal.Container className="w-full" placement="top">
          <Modal.Dialog
            aria-label="Search"
            className="mt-[12vh] max-w-xl overflow-hidden rounded-xl p-0"
          >
            <div className="flex items-center gap-2.5 border-border border-b px-4">
              <MagnifyingGlass className="size-4 shrink-0 text-muted" />
              <input
                aria-label="Search everything"
                autoFocus
                className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
                onChange={(event) => {
                  setQ(event.target.value);
                  setCursor(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setCursor(Math.min(active + 1, options.length - 1));
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setCursor(Math.max(active - 1, 0));
                  }
                  const option = options[active];
                  if (event.key === "Enter" && option) open(option);
                }}
                placeholder="Search posts, categories, tags, authors, CTAs…"
                value={q}
              />
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-1.5">
              {isSearching && !matches.length && (
                <p className="px-3 py-2.5 text-muted text-sm">
                  {isFetching
                    ? "Searching…"
                    : `No content matches “${debounced}”.`}
                </p>
              )}
              {options.length > 0 && (
                <ul>
                  {options.map((option, index) => {
                    const OptionIcon = option.icon;
                    const isScreen = !option.language;
                    const startsScreens =
                      isScreen && (index === 0 || options[index - 1]?.language);
                    return (
                      <li key={option.key}>
                        {startsScreens && (
                          <p className="px-3 pt-2 pb-1 font-medium text-[11px] text-muted">
                            Go to
                          </p>
                        )}
                        <button
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-start",
                            index === active && "bg-accent-soft",
                          )}
                          onClick={() => open(option)}
                          onMouseMove={() => setCursor(index)}
                          type="button"
                        >
                          <OptionIcon
                            className={cn(
                              "size-4 shrink-0 text-muted",
                              index === active && "text-accent",
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {option.label}
                          </span>
                          {option.detail && (
                            <span className="shrink-0 truncate text-muted text-xs">
                              {option.detail}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex gap-4 border-border border-t bg-surface-secondary px-4 py-2 text-[11px] text-muted">
              <span>↑↓ to move</span>
              <span>↵ to open</span>
              <span>esc to close</span>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
