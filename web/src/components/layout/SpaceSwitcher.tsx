"use client";

import { Dropdown, Header, Label } from "@heroui/react";
import { useSites } from "@loom-web/src/hooks/site/useSiteQueries";
import { useContextStore } from "@loom-web/src/stores/context";
import { confirmDiscard } from "@loom-web/src/stores/unsaved";
import { CaretUpDown, Check } from "@phosphor-icons/react";
import { useEffect } from "react";

const SEPARATOR = "/";

/**
 * The Site and Space everything else works in, picked from one menu: Spaces belong to a Site, so
 * the menu groups them under it rather than asking for the two separately.
 */
export function SpaceSwitcher() {
  const { data: sites } = useSites();
  const { siteId, spaceId, setSite } = useContextStore();

  const site =
    sites?.find((candidate) => candidate.id === siteId) ?? sites?.[0];
  const space =
    site?.spaces.find((candidate) => candidate.id === spaceId) ??
    site?.spaces[0];

  // The persisted context can name a Site or Space that has since been deleted, and a first visit
  // has none at all — either way the first load settles it against what actually exists.
  useEffect(() => {
    if (!site || !space) return;
    if (site.id !== siteId || space.id !== spaceId) setSite(site.id, space.id);
  }, [site, space, siteId, spaceId, setSite]);

  if (!site || !space)
    return (
      <div className="h-11 animate-pulse rounded-lg bg-surface-tertiary" />
    );

  return (
    <Dropdown>
      <Dropdown.Trigger className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start transition-colors duration-fast hover:bg-surface-tertiary/60 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent font-semibold text-accent-foreground text-sm"
        >
          {site.name.charAt(0)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold text-sm leading-5">
            {site.name}
          </span>
          <span className="truncate text-muted text-xs leading-4">
            {space.name}
          </span>
        </span>
        <CaretUpDown className="size-4 shrink-0 text-muted" />
      </Dropdown.Trigger>
      <Dropdown.Popover className="min-w-60" placement="bottom start">
        <Dropdown.Menu
          aria-label="Switch Space"
          onAction={(key) => {
            const [nextSiteId, nextSpaceId] = String(key).split(SEPARATOR);
            if (!nextSiteId || !nextSpaceId || nextSpaceId === space.id) return;
            if (confirmDiscard()) setSite(nextSiteId, nextSpaceId);
          }}
        >
          {(sites ?? []).map((candidate) => (
            <Dropdown.Section key={candidate.id}>
              <Header className="px-2 pt-1.5 pb-1 font-medium text-[11px] text-muted">
                {candidate.name}
              </Header>
              {candidate.spaces.map((option) => (
                <Dropdown.Item
                  id={`${candidate.id}${SEPARATOR}${option.id}`}
                  key={option.id}
                  textValue={option.name}
                >
                  <Label>{option.name}</Label>
                  {option.id === space.id && (
                    <Check className="ms-auto size-4 text-accent" />
                  )}
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
