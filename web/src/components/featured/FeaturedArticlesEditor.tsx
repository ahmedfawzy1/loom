"use client";

import { Button, Input, TextField } from "@heroui/react";
import type {
  ContentListItemResponseDto,
  FeaturedArticlesLocaleResponseDto,
} from "@loom/dto";
import { FEATURED_ARTICLES_MAX } from "@loom/dto/constants";
import {
  type Blog,
  CmsContentType,
  type FeaturedArticles,
} from "@loom/dto/models";
import {
  EditorProvider,
  useEditorSection,
} from "@loom-web/src/components/content/editor/EditorContext";
import {
  RailSection,
  SaveState,
} from "@loom-web/src/components/content/editor/EditorLayout";
import { EditorSkeleton } from "@loom-web/src/components/content/editor/EditorSkeleton";
import {
  PrimaryAction,
  StatusPanel,
} from "@loom-web/src/components/content/editor/WorkflowControls";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { PageHeader } from "@loom-web/src/components/ui/PageHeader";
import { Section } from "@loom-web/src/components/ui/Section";
import { SortableList } from "@loom-web/src/components/ui/SortableList";
import { useBlogs } from "@loom-web/src/hooks/content/useBlogs";
import {
  useFeaturedArticles,
  useUpdateFeaturedArticles,
} from "@loom-web/src/hooks/content/useFeaturedArticles";
import { useContextStore } from "@loom-web/src/stores/context";
import { MagnifyingGlass, Plus, Star, X } from "@phosphor-icons/react";
import { useState } from "react";

/** One language's list — keyed on Space and language, so a refetch never resets an unsaved order. */
function FeaturedList({
  featuredId,
  spaceId,
  language,
  locale,
  posts,
  onRestored,
}: {
  featuredId: FeaturedArticles["id"];
  spaceId: Blog["spaceId"];
  language: FeaturedArticlesLocaleResponseDto["languageCode"];
  locale: Serialized<FeaturedArticlesLocaleResponseDto> | undefined;
  posts: Serialized<ContentListItemResponseDto>[];
  onRestored: () => void;
}) {
  const save = useUpdateFeaturedArticles();
  const [selected, setSelected] = useState<Blog["id"][]>(locale?.blogIds ?? []);
  const [search, setSearch] = useState("");
  const localeRef = {
    type: CmsContentType.FEATURED_ARTICLES,
    id: featuredId,
    language,
  };

  useEditorSection({
    id: `locale:${language}`,
    label: language,
    order: 1,
    values: selected,
    save: () =>
      save.mutateAsync({ spaceId, language, args: { blogIds: selected } }),
  });

  // A post can drop out of the list the titles come from, by being trashed or deleted
  const titleOf = (id: Blog["id"]) =>
    posts.find((post) => post.id === id)?.title ??
    "A post that is no longer here";

  const candidates = posts.filter(
    (post) =>
      !selected.includes(post.id) &&
      post.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const isFull = selected.length >= FEATURED_ARTICLES_MAX;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <>
            <SaveState />
            <PrimaryAction locale={locale} localeRef={localeRef} />
          </>
        }
        description="The carousel on the blog's front page, in order. Each language keeps its own list."
        title="Featured"
      />

      <div className="grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-6">
        <Section
          description={`${selected.length} of up to ${FEATURED_ARTICLES_MAX}, in the order the carousel shows them.`}
          title={`Featured in ${language}`}
        >
          {selected.length === 0 ? (
            <EmptyState icon={Star} title="Nothing featured yet">
              The site shows the newest posts until you add some here.
            </EmptyState>
          ) : (
            <SortableList
              className="flex flex-col overflow-hidden rounded-lg border border-border"
              ids={selected}
              labelOf={titleOf}
              onReorder={setSelected}
              rowClassName="border-separator border-b last:border-b-0"
            >
              {(id, index, handle) => (
                <div className="flex items-center gap-3 px-2 py-1.5">
                  {handle}
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-tertiary font-medium text-muted text-xs tabular-nums">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-sm">{titleOf(id)}</span>
                  <Button
                    aria-label={`Remove ${titleOf(id)}`}
                    isIconOnly
                    onPress={() =>
                      setSelected(
                        selected.filter((candidate) => candidate !== id),
                      )
                    }
                    size="sm"
                    variant="ghost"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}
            </SortableList>
          )}
        </Section>

        <aside className="sticky top-20 flex flex-col gap-4">
          <RailSection title={`Status in ${language}`}>
            <StatusPanel
              locale={locale}
              localeRef={localeRef}
              locales={[]}
              onRestored={onRestored}
            />
          </RailSection>
          <RailSection title="Add a post">
            <TextField
              aria-label="Find a post"
              className="relative"
              onChange={setSearch}
              value={search}
            >
              <MagnifyingGlass className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input className="h-8 ps-8 text-sm" placeholder="Find a post…" />
            </TextField>
            <ul className="-mx-1 flex max-h-80 flex-col overflow-y-auto">
              {candidates.map((post) => (
                <li key={post.id}>
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors duration-fast hover:bg-surface-secondary disabled:opacity-50"
                    disabled={isFull}
                    onClick={() => setSelected([...selected, post.id])}
                    type="button"
                  >
                    <Plus className="size-3.5 shrink-0 text-muted" />
                    <span className="truncate">{post.title}</span>
                  </button>
                </li>
              ))}
              {candidates.length === 0 && (
                <li className="px-2 py-1.5 text-muted text-sm">
                  No other posts match.
                </li>
              )}
            </ul>
            {isFull && (
              <p className="text-muted text-xs">
                The list is full. Remove one to add another.
              </p>
            )}
          </RailSection>
        </aside>
      </div>
    </div>
  );
}

export function FeaturedArticlesEditor() {
  const spaceId = useContextStore((state) => state.spaceId);
  const language = useContextStore((state) => state.languageCode);

  const { data: featured, isPending } = useFeaturedArticles(
    spaceId ?? undefined,
  );
  // A restore replaces what the list was seeded from, so it is the one time it reloads
  const [restores, setRestores] = useState(0);
  const { data: blogList } = useBlogs(
    { spaceId: spaceId ?? "", language, pageSize: 100 },
    Boolean(spaceId),
  );

  if (!spaceId || isPending) return <EditorSkeleton />;
  if (!featured)
    return (
      <EmptyState icon={Star} title="No featured list">
        This Space has no featured list.
      </EmptyState>
    );

  return (
    <EditorProvider key={`${spaceId}:${language}:${restores}`}>
      <FeaturedList
        featuredId={featured.id}
        language={language}
        locale={featured.locales.find(
          (candidate) => candidate.languageCode === language,
        )}
        onRestored={() => setRestores((count) => count + 1)}
        posts={blogList?.items ?? []}
        spaceId={spaceId}
      />
    </EditorProvider>
  );
}
