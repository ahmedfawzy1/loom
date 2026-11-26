"use client";

import { CmsContentType, type LocaleStatus } from "@loom/dto/models";
import { ContentList } from "@loom-web/src/components/content/ContentList";
import { useContentListState } from "@loom-web/src/hooks/content/useContentListState";
import { useCtas } from "@loom-web/src/hooks/content/useCtas";
import { Megaphone } from "@phosphor-icons/react";

export function CtaList({ initialStatus }: { initialStatus?: LocaleStatus }) {
  const state = useContentListState(initialStatus);
  const { data, isPending, error } = useCtas(state.query, state.enabled);

  return (
    <ContentList
      createLabel="New CTA"
      data={data}
      description="Call-to-action blocks placed inside post bodies."
      empty={{
        icon: Megaphone,
        title: "No CTAs yet",
        text: "A CTA is a reusable button block that writers drop into a post.",
      }}
      error={error}
      isPending={isPending}
      searchPlaceholder="Search CTAs…"
      state={state}
      title="CTAs"
      type={CmsContentType.CTA}
    />
  );
}
