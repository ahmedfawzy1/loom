"use client";

import type { CategoryLocaleResponseDto, CategoryResponseDto } from "@loom/dto";
import {
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_SEO_DESCRIPTION_MAX_LENGTH,
  CATEGORY_SEO_DESCRIPTION_MIN_LENGTH,
  CATEGORY_SEO_TITLE_MAX_LENGTH,
  CATEGORY_TITLE_MAX_LENGTH,
} from "@loom/dto/constants";
import { type Category, CmsContentType } from "@loom/dto/models";
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
  useCategory,
  useCreateCategory,
  useUpdateCategory,
  useUpdateCategoryLocale,
} from "@loom-web/src/hooks/content/useCategories";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useContextStore } from "@loom-web/src/stores/context";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CategoryData = Serialized<CategoryResponseDto>;

function NewCategoryForm() {
  const router = useRouter();
  const spaceId = useContextStore((state) => state.spaceId);
  const createCategory = useCreateCategory();

  const [slug, setSlug] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  return (
    <NewItemForm
      error={createCategory.error}
      isDisabled={!spaceId}
      isPending={createCategory.isPending}
      listHref="/categories"
      listLabel="Categories"
      onCreate={() => {
        if (!spaceId) return;
        createCategory.mutate(
          { spaceId, slug, gameCode, title, description },
          { onSuccess: (created) => router.push(`/categories/${created.id}`) },
        );
      }}
      subtitle="The slug and game code identify the category in every language."
      title="New category"
    >
      <FormField
        isTitle
        label="Title"
        name="title"
        maxLength={CATEGORY_TITLE_MAX_LENGTH}
        onChange={setTitle}
        placeholder="Murder Mystery 2"
        value={title}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          hint="Lowercase letters, numbers and dashes"
          label="Slug"
          mono
          onChange={setSlug}
          placeholder="mm2"
          value={slug}
        />
        <FormField
          hint="Short internal id, like mm2 or sab"
          label="Game code"
          mono
          onChange={setGameCode}
          placeholder="mm2"
          value={gameCode}
        />
      </div>
      <FormField
        label="Description"
        name="description"
        maxLength={CATEGORY_DESCRIPTION_MAX_LENGTH}
        multiline
        onChange={setDescription}
        value={description}
      />
    </NewItemForm>
  );
}

function CategoryDetails({ category }: { category: CategoryData }) {
  const updateCategory = useUpdateCategory();

  const [slug, setSlug] = useState(category.slug);
  const [gameCode, setGameCode] = useState(category.gameCode);
  const [featuredImageId, setFeaturedImageId] = useState<
    Category["featuredImageId"]
  >(category.featuredImageId);
  const [featureIconId, setFeatureIconId] = useState<Category["featureIconId"]>(
    category.featureIconId,
  );
  const [gameCoverId, setGameCoverId] = useState<Category["gameCoverId"]>(
    category.gameCoverId,
  );
  const args = { slug, gameCode, featuredImageId, featureIconId, gameCoverId };

  useEditorSection({
    id: "shared",
    label: "Category details",
    order: 0,
    values: args,
    save: () => updateCategory.mutateAsync({ id: category.id, args }),
  });

  return (
    <RailSection title="Category details · every language">
      <FormField label="Slug" mono onChange={setSlug} value={slug} />
      <FormField
        label="Game code"
        mono
        onChange={setGameCode}
        value={gameCode}
      />
      <ImageField
        field="category.featuredImage"
        label="Featured image"
        onChange={setFeaturedImageId}
        value={featuredImageId}
      />
      <ImageField
        field="category.featureIcon"
        label="Feature icon"
        onChange={setFeatureIconId}
        value={featureIconId}
      />
      <ImageField
        field="category.gameCover"
        label="Game cover"
        onChange={setGameCoverId}
        value={gameCoverId}
      />
    </RailSection>
  );
}

/** One language of one category — keyed on both, so a refetch never overwrites what is typed. */
function CategoryContent({
  category,
  language,
}: {
  category: CategoryData;
  language: CategoryLocaleResponseDto["languageCode"];
}) {
  const updateLocale = useUpdateCategoryLocale();

  const locale = category.locales.find(
    (candidate) => candidate.languageCode === language,
  );

  const [title, setTitle] = useState(locale?.title ?? "");
  const [description, setDescription] = useState(locale?.description ?? "");
  const [seoMetaTitle, setSeoMetaTitle] = useState(locale?.seoMetaTitle ?? "");
  const [seoMetaDescription, setSeoMetaDescription] = useState(
    locale?.seoMetaDescription ?? "",
  );

  useEditorSection({
    id: `locale:${language}`,
    label: language,
    order: 1,
    values: { title, description, seoMetaTitle, seoMetaDescription },
    save: () =>
      updateLocale.mutateAsync({
        id: category.id,
        language,
        args: {
          title,
          description,
          seoMetaTitle: seoMetaTitle || null,
          seoMetaDescription: seoMetaDescription || null,
        },
      }),
  });

  return (
    <>
      <Section bodyClassName="gap-5 px-6 pb-6">
        <FormField
          isTitle
          label="Title"
          name="title"
          maxLength={CATEGORY_TITLE_MAX_LENGTH}
          onChange={setTitle}
          value={title}
        />
        <FormField
          label="Description"
          name="description"
          maxLength={CATEGORY_DESCRIPTION_MAX_LENGTH}
          multiline
          onChange={setDescription}
          rows={5}
          value={description}
        />
      </Section>
      <Section
        description="Leave these blank to use the title and description."
        title="Search and sharing"
      >
        <FormField
          hint="Unique in this language."
          label="Meta title"
          name="seoMetaTitle"
          maxLength={CATEGORY_SEO_TITLE_MAX_LENGTH}
          onChange={setSeoMetaTitle}
          value={seoMetaTitle}
        />
        <FormField
          hint={`At least ${CATEGORY_SEO_DESCRIPTION_MIN_LENGTH} characters when set.`}
          label="Meta description"
          name="seoMetaDescription"
          maxLength={CATEGORY_SEO_DESCRIPTION_MAX_LENGTH}
          multiline
          onChange={setSeoMetaDescription}
          value={seoMetaDescription}
        />
      </Section>
    </>
  );
}

export function CategoryForm({ categoryId }: { categoryId?: Category["id"] }) {
  const language = useContextStore((state) => state.languageCode);
  const { site } = useActiveSite();
  const { data: category, error } = useCategory(categoryId);
  // A restore or a translation replaces what the forms were seeded from, so they reload
  const [reloads, setReloads] = useState(0);

  if (!categoryId) return <NewCategoryForm />;
  if (error) return <ErrorText message={error.message} />;
  if (!category) return <EditorSkeleton />;

  const locale = category.locales.find(
    (candidate) => candidate.languageCode === language,
  );
  const source = category.locales.find(
    (candidate) => candidate.languageCode === site?.defaultLanguage,
  );

  return (
    <EditorProvider key={`${category.id}:${language}:${reloads}`}>
      <EditorLayout
        deletedAt={category.deletedAt}
        itemId={category.id}
        locale={locale}
        locales={category.locales}
        main={<CategoryContent category={category} language={language} />}
        onReload={() => setReloads((count) => count + 1)}
        shared={
          language === site?.defaultLanguage ? (
            <CategoryDetails category={category} />
          ) : (
            <SharedFieldsNotice fields="The slug, game code and images" />
          )
        }
        title={locale?.title || source?.title || ""}
        type={CmsContentType.CATEGORY}
      />
    </EditorProvider>
  );
}
