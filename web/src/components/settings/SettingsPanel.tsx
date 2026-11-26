"use client";

import type { SiteResponseDto } from "@loom/dto";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { LoadingRows } from "@loom-web/src/components/ui/LoadingRows";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { Browsers } from "@phosphor-icons/react";
import type { ReactNode } from "react";

/** A settings page about the active Site, rendered once that Site has loaded. */
export function SettingsPanel({
  children,
}: {
  children: (site: Serialized<SiteResponseDto>) => ReactNode;
}) {
  const { site, isPending, error } = useActiveSite();

  if (isPending)
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <LoadingRows rows={4} />
      </div>
    );
  if (error) return <ErrorText message={error.message} />;
  if (!site)
    return (
      <div className="rounded-xl border border-border bg-surface">
        <EmptyState icon={Browsers} title="No sites yet">
          Settings apply to a site, so there is nothing to set until one exists.
        </EmptyState>
      </div>
    );

  return children(site);
}
