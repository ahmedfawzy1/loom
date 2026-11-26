"use client";

import type { ListContentRequestDto } from "@loom/dto";
import { LIST_MAX_PAGE_SIZE } from "@loom/dto/constants";
import { CmsContentType, type LocaleStatus } from "@loom/dto/models";
import type { FilterDef } from "@loom-web/src/components/content/ContentFilterBar";
import { ContentList } from "@loom-web/src/components/content/ContentList";
import { useAuthors } from "@loom-web/src/hooks/content/useAuthors";
import { useBlogs } from "@loom-web/src/hooks/content/useBlogs";
import { useCategories } from "@loom-web/src/hooks/content/useCategories";
import {
  type ContentListState,
  useContentListState,
} from "@loom-web/src/hooks/content/useContentListState";
import { useTags } from "@loom-web/src/hooks/content/useTags";
import { Article } from "@phosphor-icons/react";

/** A post's own filters: its category, byline and tags, chosen from the Space's own. */
function usePostFilters(state: ContentListState): FilterDef[] {
  const choices: ListContentRequestDto = {
    spaceId: state.spaceId ?? "",
    language: state.language,
    sort: "title",
    direction: "asc",
    pageSize: LIST_MAX_PAGE_SIZE,
  };
  const { data: categories } = useCategories(choices, state.enabled);
  const { data: authors } = useAuthors(choices, state.enabled);
  const { data: tags } = useTags(choices, state.enabled);
  const options = (items: { id: string; title: string }[] | undefined) =>
    (items ?? []).map((item) => ({ id: item.id, label: item.title }));

  return [
    {
      key: "category",
      label: "Category",
      anyLabel: "Any category",
      options: options(categories?.items),
      value: state.filters.categoryId,
      onChange: (id) => state.setFilter("categoryId", id),
    },
    {
      key: "author",
      label: "Author",
      anyLabel: "Any author",
      options: options(authors?.items),
      value: state.filters.authorId,
      onChange: (id) => state.setFilter("authorId", id),
    },
    {
      key: "tag",
      label: "Tag",
      anyLabel: "Any tag",
      options: options(tags?.items),
      value: state.filters.tagId,
      onChange: (id) => state.setFilter("tagId", id),
    },
  ];
}

export function BlogList({ initialStatus }: { initialStatus?: LocaleStatus }) {
  const state = useContentListState(initialStatus);
  const { data, isPending, error } = useBlogs(state.query, state.enabled);
  const filters = usePostFilters(state);

  return (
    <ContentList
      createLabel="New post"
      data={data}
      description="Every post, its translations and where each is live."
      empty={{
        icon: Article,
        title: "No posts yet",
        text: "Write the first post in the source language; translations follow from it.",
      }}
      error={error}
      filters={filters}
      isPending={isPending}
      searchPlaceholder="Search posts…"
      state={state}
      title="Posts"
      type={CmsContentType.BLOG}
    />
  );
}
