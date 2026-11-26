"use client";

import { Button, toast } from "@heroui/react";
import type { SiteResponseDto } from "@loom/dto";
import { CmsRole } from "@loom/dto/models";
import { SettingsPanel } from "@loom-web/src/components/settings/SettingsPanel";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { Section } from "@loom-web/src/components/ui/Section";
import { useRefreshLivePages } from "@loom-web/src/hooks/site/useRefreshLivePages";
import { useCurrentUser } from "@loom-web/src/hooks/user/useCurrentUser";
import { useContextStore } from "@loom-web/src/stores/context";
import { ArrowsClockwise } from "@phosphor-icons/react";
import Link from "next/link";

function RefreshLivePages({ site }: { site: Serialized<SiteResponseDto> }) {
  const spaceId = useContextStore((state) => state.spaceId);
  const { data: user } = useCurrentUser();
  const refresh = useRefreshLivePages();

  const space =
    site.spaces.find((candidate) => candidate.id === spaceId) ?? site.spaces[0];
  const isConnected = Boolean(site.revalidateUrl && site.hasRevalidateSecret);

  return (
    <Section>
      <p className="text-sm leading-6">
        Asks {site.domain} to rebuild every page it serves from the{" "}
        <span className="font-medium">{space?.name}</span> Space. Pages rebuild
        as visitors next open them, so nothing goes down.
      </p>

      {isConnected ? (
        <p className="text-muted text-xs">
          Sent to <code className="font-mono">{site.revalidateUrl}</code>
        </p>
      ) : (
        <Notice title="No refresh endpoint yet" tone="warning">
          {site.name} has no refresh endpoint and secret, so the website never
          hears about changes.{" "}
          {user?.role === CmsRole.ADMIN ? (
            <Link className="font-medium underline" href="/settings/sites">
              Set them in Sites
            </Link>
          ) : (
            "An admin can set them in Sites."
          )}
        </Notice>
      )}

      <div>
        <Button
          isDisabled={!isConnected || !space || refresh.isPending}
          onPress={() =>
            space &&
            refresh.mutate(space.id, {
              onSuccess: () =>
                toast.success(`${site.domain} accepted the refresh`),
              onError: (error) => toast.danger(error.message),
            })
          }
        >
          <ArrowsClockwise className="size-4" />
          {refresh.isPending ? "Refreshing…" : "Refresh live pages"}
        </Button>
      </div>
    </Section>
  );
}

/**
 * The one manual refresh: every page of the selected Space's website. Publishing already
 * refreshes the pages it changes; this is for when the website missed one — it was down, or its
 * secret was wrong at the time.
 */
export function RefreshLivePagesPanel() {
  return (
    <SettingsPanel>{(site) => <RefreshLivePages site={site} />}</SettingsPanel>
  );
}
