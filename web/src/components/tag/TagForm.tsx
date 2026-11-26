"use client";

import type { TagLocaleResponseDto, TagResponseDto } from "@loom/dto";
import {
  TAG_DESCRIPTION_MAX_LENGTH,
  TAG_TITLE_MAX_LENGTH,
} from "@loom/dto/constants";
import { CmsContentType, type Tag } from "@loom/dto/models";
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
import { FormField } from "@loom-web/src/components/content/FormField";
import { SharedFieldsNotice } from "@loom-web/src/components/content/SharedFieldsNotice";
import { ImageField } from "@loom-web/src/components/media/ImageField";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { Section } from "@loom-web/src/components/ui/Section";
import {
  useCreateTag,
  useTag,
  useUpdateTag,
  useUpdateTagLocale,
} from "@loom-web/src/hooks/content/useTags";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useContextStore } from "@loom-web/src/stores/context";
import { useRouter } from "next/navigation";
import { useState } from "react";

type TagData = Serialized<TagResponseDto>;

function NewTagForm() {
  const router = useRouter();
  const spaceId = useContextStore((state) => state.spaceId);
  const createTag = useCreateTag();

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  return (
    <NewItemForm
      error={createTag.error}
      isDisabled={!spaceId}
      isPending={createTag.isPending}
      listHref="/tags"
      listLabel="Tags"
      onCreate={() => {
        if (!spaceId) return;
        createTag.mutate(
          { spaceId, slug, title, description },
          { onSuccess: (created) => router.push(`/tags/${created.id}`) },
        );
      }}
      subtitle="The slug identifies the tag in every language."
      title="New tag"
    >
      <FormField
        hint="No leading #"
        isTitle
        label="Title"
        name="title"
        maxLength={TAG_TITLE_MAX_LENGTH}
        onChange={setTitle}
        placeholder="Godly"
        value={title}
      />
      <FormField
        hint="Lowercase letters, numbers and dashes"
        label="Slug"
        mono
        onChange={setSlug}
        placeholder="godly"
        value={slug}
      />
      <FormField
        label="Description"
        name="description"
        maxLength={TAG_DESCRIPTION_MAX_LENGTH}
        multiline
        onChange={setDescription}
        value={description}
      />
    </NewItemForm>
  );
}

function TagDetails({ tag }: { tag: TagData }) {
  const updateTag = useUpdateTag();

  const [slug, setSlug] = useState(tag.slug);
  const [featuredImageId, setFeaturedImageId] = useState<
    Tag["featuredImageId"]
  >(tag.featuredImageId);
  const args = { slug, featuredImageId };

  useEditorSection({
    id: "shared",
    label: "Tag details",
    order: 0,
    values: args,
    save: () => updateTag.mutateAsync({ id: tag.id, args }),
  });

  return (
    <RailSection title="Tag details · every language">
      <FormField label="Slug" mono onChange={setSlug} value={slug} />
      <ImageField
        field="tag.featuredImage"
        label="Featured image"
        onChange={setFeaturedImageId}
        value={featuredImageId}
      />
    </RailSection>
  );
}

/** One language of one tag — keyed on both, so a refetch never overwrites what is typed. */
function TagContent({
  tag,
  language,
}: {
  tag: TagData;
  language: TagLocaleResponseDto["languageCode"];
}) {
  const updateLocale = useUpdateTagLocale();

  const locale = tag.locales.find(
    (candidate) => candidate.languageCode === language,
  );

  const [title, setTitle] = useState(locale?.title ?? "");
  const [description, setDescription] = useState(locale?.description ?? "");
  const args = { title, description };

  useEditorSection({
    id: `locale:${language}`,
    label: language,
    order: 1,
    values: args,
    save: () => updateLocale.mutateAsync({ id: tag.id, language, args }),
  });

  return (
    <Section bodyClassName="gap-5 px-6 pb-6">
      <FormField
        hint="No leading #"
        isTitle
        label="Title"
        name="title"
        maxLength={TAG_TITLE_MAX_LENGTH}
        onChange={setTitle}
        value={title}
      />
      <FormField
        label="Description"
        name="description"
        maxLength={TAG_DESCRIPTION_MAX_LENGTH}
        multiline
        onChange={setDescription}
        rows={5}
        value={description}
      />
    </Section>
  );
}

export function TagForm({ tagId }: { tagId?: Tag["id"] }) {
  const language = useContextStore((state) => state.languageCode);
  const { site } = useActiveSite();
  const { data: tag, error } = useTag(tagId);
  // A restore or a translation replaces what the forms were seeded from, so they reload
  const [reloads, setReloads] = useState(0);

  if (!tagId) return <NewTagForm />;
  if (error) return <ErrorText message={error.message} />;
  if (!tag) return <EditorSkeleton />;

  const locale = tag.locales.find(
    (candidate) => candidate.languageCode === language,
  );
  const source = tag.locales.find(
    (candidate) => candidate.languageCode === site?.defaultLanguage,
  );

  return (
    <EditorProvider key={`${tag.id}:${language}:${reloads}`}>
      <EditorLayout
        deletedAt={tag.deletedAt}
        itemId={tag.id}
        locale={locale}
        locales={tag.locales}
        main={<TagContent language={language} tag={tag} />}
        onReload={() => setReloads((count) => count + 1)}
        shared={
          language === site?.defaultLanguage ? (
            <TagDetails tag={tag} />
          ) : (
            <SharedFieldsNotice fields="The slug and featured image" />
          )
        }
        title={locale?.title || source?.title || ""}
        type={CmsContentType.TAG}
      />
    </EditorProvider>
  );
}
