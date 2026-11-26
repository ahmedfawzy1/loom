"use client";

import { CmsContentType, type LocaleStatus } from "@loom/dto/models";
import { ContentList } from "@loom-web/src/components/content/ContentList";
import { useCategories } from "@loom-web/src/hooks/content/useCategories";
import { useContentListState } from "@loom-web/src/hooks/content/useContentListState";
import { FolderSimple } from "@phosphor-icons/react";

export function CategoryList({
  initialStatus,
}: {
  initialStatus?: LocaleStatus;
}) {
  const state = useContentListState(initialStatus);
  const { data, isPending, error } = useCategories(state.query, state.enabled);

  return (
    <ContentList
      createLabel="New category"
      data={data}
      description="Game categories, each with its own page on the website."
      empty={{
        icon: FolderSimple,
        title: "No categories yet",
        text: "Categories group posts by game. Add one to give posts a home.",
      }}
      error={error}
      isPending={isPending}
      searchPlaceholder="Search categories…"
      state={state}
      title="Categories"
      type={CmsContentType.CATEGORY}
    />
  );
}
