"use client";

import { CmsContentType, type LocaleStatus } from "@loom/dto/models";
import { ContentList } from "@loom-web/src/components/content/ContentList";
import { useContentListState } from "@loom-web/src/hooks/content/useContentListState";
import { useTags } from "@loom-web/src/hooks/content/useTags";
import { Tag } from "@phosphor-icons/react";

export function TagList({ initialStatus }: { initialStatus?: LocaleStatus }) {
  const state = useContentListState(initialStatus);
  const { data, isPending, error } = useTags(state.query, state.enabled);

  return (
    <ContentList
      createLabel="New tag"
      data={data}
      description="Topics that cut across every category."
      empty={{
        icon: Tag,
        title: "No tags yet",
        text: "Tags label posts by topic, across every category.",
      }}
      error={error}
      isPending={isPending}
      searchPlaceholder="Search tags…"
      state={state}
      title="Tags"
      type={CmsContentType.TAG}
    />
  );
}
