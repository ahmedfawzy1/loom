"use client";

import { cn } from "@heroui/react";
import type {
  BlogLocaleResponseDto,
  BlogResponseDto,
  FaqItemDto,
} from "@loom/dto";
import {
  BLOG_DESCRIPTION_MAX_LENGTH,
  BLOG_MAX_TAGS,
  BLOG_SUMMARY_MAX_LENGTH,
  BLOG_SUMMARY_MIN_LENGTH,
  BLOG_TITLE_MAX_LENGTH,
  BLOG_UPDATE_NOTE_MAX_LENGTH,
} from "@loom/dto/constants";
import { type Blog, type BlogTag, CmsContentType } from "@loom/dto/models";
import { FaqEditor } from "@loom-web/src/components/blog/FaqEditor";
import {
  EditorProvider,
  useEditorSection,
} from "@loom-web/src/components/content/editor/EditorContext";
import {
  EditorLayout,
  RailSection,
} from "@loom-web/src/components/content/editor/EditorLayout";
import { EditorSkeleton } from "@loom-web/src/components/content/editor/EditorSkeleton";
import { NewItemForm } from "@loom-web/src/components/content/editor/NewItemForm";
import { ReferenceSelect } from "@loom-web/src/components/content/editor/ReferenceSelect";
import { FieldSourceNote } from "@loom-web/src/components/content/editor/SourceSync";
import { FormField } from "@loom-web/src/components/content/FormField";
import { SharedFieldsNotice } from "@loom-web/src/components/content/SharedFieldsNotice";
import { RichTextEditor } from "@loom-web/src/components/editor/RichTextEditor";
import { ImageField } from "@loom-web/src/components/media/ImageField";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { Section } from "@loom-web/src/components/ui/Section";
import { useAuthors } from "@loom-web/src/hooks/content/useAuthors";
import {
  useBlog,
  useCreateBlog,
  useUpdateBlog,
  useUpdateBlogLocale,
} from "@loom-web/src/hooks/content/useBlogs";
import { useCategories } from "@loom-web/src/hooks/content/useCategories";
import { useTags } from "@loom-web/src/hooks/content/useTags";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useContextStore } from "@loom-web/src/stores/context";
import type { JSONContent } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const NONE = "none";

// Matches the API's own EMPTY_DOCUMENT — what a post has before anything is written
const EMPTY_DOCUMENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/** Every reference picker lists items from the current Space in the current language. */
function useSpaceOptions() {
  const spaceId = useContextStore((state) => state.spaceId);
  const language = useContextStore((state) => state.languageCode);
  const query = { spaceId: spaceId ?? "", language, pageSize: 100 };
  const enabled = Boolean(spaceId);

  return {
    authors: useAuthors(query, enabled).data?.items ?? [],
    categories: useCategories(query, enabled).data?.items ?? [],
    tags: useTags(query, enabled).data?.items ?? [],
  };
}

function TagPicker({
  selected,
  onChange,
  options,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  options: { id: string; title: string }[];
}) {
  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((candidate) => candidate !== id)
        : [...selected, id],
    );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-[13px]">Tags</span>
        <span className="text-muted text-xs tabular-nums">
          {selected.length}/{BLOG_MAX_TAGS}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.length === 0 && (
          <span className="text-muted text-xs">No tags in this Space yet.</span>
        )}
        {options.map((option) => {
          const index = selected.indexOf(option.id);
          const isSelected = index >= 0;
          return (
            <button
              aria-pressed={isSelected}
              className={cn(
                "h-6 rounded-md border px-2 text-xs transition-colors duration-fast disabled:opacity-50",
                isSelected
                  ? "border-accent/40 bg-accent-soft text-accent-soft-foreground"
                  : "border-border text-muted hover:text-foreground",
              )}
              disabled={!isSelected && selected.length >= BLOG_MAX_TAGS}
              key={option.id}
              onClick={() => toggle(option.id)}
              type="button"
            >
              {isSelected && (
                <span className="me-1 tabular-nums">{index + 1}</span>
              )}
              {option.title}
            </button>
          );
        })}
      </div>
      <span className="text-muted text-xs">
        The first tag picked shows first on the post.
      </span>
    </div>
  );
}

type BlogData = Serialized<BlogResponseDto>;

function NewBlogForm() {
  const router = useRouter();
  const spaceId = useContextStore((state) => state.spaceId);
  const options = useSpaceOptions();
  const createBlog = useCreateBlog();

  const [authorId, setAuthorId] = useState<Blog["authorId"] | typeof NONE>(
    NONE,
  );
  const [categoryId, setCategoryId] = useState<
    NonNullable<Blog["categoryId"]> | typeof NONE
  >(NONE);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");

  return (
    <NewItemForm
      error={createBlog.error}
      // Disabled with a visible reason rather than a guard clause that swallows the click
      isDisabled={!spaceId || authorId === NONE}
      isPending={createBlog.isPending}
      listHref="/blogs"
      listLabel="Posts"
      onCreate={() => {
        if (!spaceId || authorId === NONE) return;
        createBlog.mutate(
          {
            spaceId,
            authorId,
            categoryId: categoryId === NONE ? undefined : categoryId,
            title,
            description,
            slug: slug || undefined,
          },
          { onSuccess: (created) => router.push(`/blogs/${created.id}`) },
        );
      }}
      subtitle="Start with the essentials. The body, FAQ and translations come next, in the editor."
      title="New post"
    >
      {options.authors.length === 0 && (
        <Notice tone="warning">
          This Space has no authors yet. Create one first: a post can't exist
          without a byline.
        </Notice>
      )}
      <FormField
        isTitle
        label="Title"
        name="title"
        maxLength={BLOG_TITLE_MAX_LENGTH}
        onChange={setTitle}
        value={title}
      />
      <FormField
        label="Description"
        maxLength={BLOG_DESCRIPTION_MAX_LENGTH}
        multiline
        onChange={setDescription}
        value={description}
      />
      <FormField
        hint="Leave blank to make it from the title."
        label="Slug"
        mono
        onChange={setSlug}
        value={slug}
      />
      <div className="grid grid-cols-2 gap-4">
        <ReferenceSelect
          label="Author"
          onChange={(value) => setAuthorId(value ?? NONE)}
          options={options.authors}
          placeholder="Pick an author"
          value={authorId === NONE ? null : authorId}
        />
        <ReferenceSelect
          allowNone
          label="Category"
          onChange={(value) => setCategoryId(value ?? NONE)}
          options={options.categories}
          value={categoryId === NONE ? null : categoryId}
        />
      </div>
    </NewItemForm>
  );
}

/** The fields every language of the post shares, edited from the default language only. */
function BlogReferences({ blog }: { blog: BlogData }) {
  const options = useSpaceOptions();
  const updateBlog = useUpdateBlog();

  const [authorId, setAuthorId] = useState<Blog["authorId"]>(blog.authorId);
  const [reviewerId, setReviewerId] = useState<Blog["reviewerId"]>(
    blog.reviewerId,
  );
  const [categoryId, setCategoryId] = useState<Blog["categoryId"]>(
    blog.categoryId,
  );
  const [tagIds, setTagIds] = useState<BlogTag["tagId"][]>(blog.tagIds);
  const [imageId, setImageId] = useState<Blog["imageId"]>(blog.imageId);
  const args = { authorId, reviewerId, categoryId, tagIds, imageId };

  useEditorSection({
    id: "shared",
    label: "Post details",
    order: 0,
    values: args,
    save: () => updateBlog.mutateAsync({ id: blog.id, args }),
  });

  return (
    <RailSection title="Post details · every language">
      <ImageField
        field="blog.image"
        label="Cover image"
        onChange={setImageId}
        value={imageId}
      />
      <ReferenceSelect
        label="Author"
        onChange={(value) => value && setAuthorId(value)}
        options={options.authors}
        value={authorId}
      />
      <ReferenceSelect
        allowNone
        label="Reviewer"
        onChange={setReviewerId}
        options={options.authors}
        value={reviewerId}
      />
      <ReferenceSelect
        allowNone
        label="Category"
        onChange={setCategoryId}
        options={options.categories}
        value={categoryId}
      />
      <TagPicker
        onChange={setTagIds}
        options={options.tags}
        selected={tagIds}
      />
    </RailSection>
  );
}

/**
 * One language of one post. The parent keys it on both, so its fields are seeded once when that
 * pair opens: a refetch after saving never overwrites what is being typed, and the editor's undo
 * history cannot reach back into another language's text.
 */
function BlogContent({
  blog,
  language,
}: {
  blog: BlogData;
  language: BlogLocaleResponseDto["languageCode"];
}) {
  const updateLocale = useUpdateBlogLocale();
  const { site } = useActiveSite();
  const dir = site?.languages.find((candidate) => candidate.code === language)
    ?.rtl
    ? "rtl"
    : "ltr";

  const locale = blog.locales.find(
    (candidate) => candidate.languageCode === language,
  );

  const [title, setTitle] = useState(locale?.title ?? "");
  const [description, setDescription] = useState(locale?.description ?? "");
  const [slug, setSlug] = useState(locale?.slug ?? "");
  const [summary, setSummary] = useState(locale?.summary ?? "");
  const [updateNote, setUpdateNote] = useState(locale?.updateNote ?? "");
  const [body, setBody] = useState<JSONContent>(
    (locale?.body as JSONContent | undefined) ?? EMPTY_DOCUMENT,
  );
  const [faq, setFaq] = useState<FaqItemDto[]>(
    (locale?.faq as FaqItemDto[] | undefined) ?? [],
  );
  const args = { title, description, slug, summary, updateNote, body, faq };

  useEditorSection({
    id: `locale:${language}`,
    label: language,
    order: 1,
    values: args,
    save: () =>
      updateLocale.mutateAsync({
        id: blog.id,
        language,
        args: {
          ...args,
          faq: faq.filter((item) => item.question.trim() || item.answer.trim()),
        },
      }),
  });

  return (
    <>
      <Section bodyClassName="gap-5 px-6 pb-6">
        <FormField
          dir={dir}
          isTitle
          label="Title"
          name="title"
          maxLength={BLOG_TITLE_MAX_LENGTH}
          onChange={setTitle}
          placeholder="What is this post about?"
          value={title}
        />
        <FormField
          dir={dir}
          hint={`The lead shown under the title. At least ${BLOG_SUMMARY_MIN_LENGTH} characters.`}
          label="Summary"
          name="summary"
          maxLength={BLOG_SUMMARY_MAX_LENGTH}
          multiline
          onChange={setSummary}
          rows={4}
          value={summary}
        />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[13px]">Body</span>
            <FieldSourceNote name="body" />
          </div>
          <RichTextEditor
            currentEntryId={blog.id}
            dir={dir}
            initialContent={body}
            onChange={setBody}
          />
        </div>
      </Section>

      <Section
        actions={<FieldSourceNote name="faq" />}
        description="Questions and answers shown at the end of the post, in this order."
        title={`FAQ${faq.length ? ` · ${faq.length}` : ""}`}
      >
        <FaqEditor dir={dir} items={faq} onChange={setFaq} />
      </Section>

      <Section
        description="How this language of the post appears in search results and links."
        title="Search and sharing"
      >
        <FormField
          dir={dir}
          hint="Any script. It stays fixed after the first publish."
          label="Slug"
          mono
          onChange={setSlug}
          value={slug}
        />
        <FormField
          dir={dir}
          label="Meta description"
          name="description"
          maxLength={BLOG_DESCRIPTION_MAX_LENGTH}
          multiline
          onChange={setDescription}
          value={description}
        />
        <FormField
          dir={dir}
          hint="Say what changed when you revise a published post."
          label="Update note"
          name="updateNote"
          maxLength={BLOG_UPDATE_NOTE_MAX_LENGTH}
          multiline
          onChange={setUpdateNote}
          rows={2}
          value={updateNote}
        />
      </Section>
    </>
  );
}

export function BlogForm({ blogId }: { blogId?: Blog["id"] }) {
  const language = useContextStore((state) => state.languageCode);
  const { site } = useActiveSite();
  const { data: blog, error } = useBlog(blogId);
  // A restore or a translation replaces what the forms were seeded from, so they reload
  const [reloads, setReloads] = useState(0);

  if (!blogId) return <NewBlogForm />;
  if (error) return <ErrorText message={error.message} />;
  if (!blog) return <EditorSkeleton />;

  const locale = blog.locales.find(
    (candidate) => candidate.languageCode === language,
  );
  const source = blog.locales.find(
    (candidate) => candidate.languageCode === site?.defaultLanguage,
  );

  return (
    <EditorProvider key={`${blog.id}:${language}:${reloads}`}>
      <EditorLayout
        deletedAt={blog.deletedAt}
        itemId={blog.id}
        locale={locale}
        locales={blog.locales}
        main={<BlogContent blog={blog} language={language} />}
        onReload={() => setReloads((count) => count + 1)}
        shared={
          language === site?.defaultLanguage ? (
            <BlogReferences blog={blog} />
          ) : (
            <SharedFieldsNotice fields="The cover image, author, reviewer, category and tags" />
          )
        }
        title={locale?.title || source?.title || ""}
        type={CmsContentType.BLOG}
      />
    </EditorProvider>
  );
}
