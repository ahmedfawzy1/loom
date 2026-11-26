"use client";

import { CmsContentType, type LocaleStatus } from "@loom/dto/models";
import { ContentList } from "@loom-web/src/components/content/ContentList";
import { useAuthors } from "@loom-web/src/hooks/content/useAuthors";
import { useContentListState } from "@loom-web/src/hooks/content/useContentListState";
import { UserCircle } from "@phosphor-icons/react";

export function AuthorList({
  initialStatus,
}: {
  initialStatus?: LocaleStatus;
}) {
  const state = useContentListState(initialStatus);
  const { data, isPending, error } = useAuthors(state.query, state.enabled);

  return (
    <ContentList
      createLabel="New author"
      data={data}
      description="Bylines and reviewers for posts."
      empty={{
        icon: UserCircle,
        title: "No authors yet",
        text: "Every post needs an author, so add one before the first post.",
      }}
      error={error}
      isPending={isPending}
      searchPlaceholder="Search authors…"
      state={state}
      title="Authors"
      type={CmsContentType.AUTHOR}
    />
  );
}
