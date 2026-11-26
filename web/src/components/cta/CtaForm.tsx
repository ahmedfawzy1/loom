"use client";

import type { CtaLocaleResponseDto, CtaResponseDto } from "@loom/dto";
import {
  CTA_BUTTON_LABEL_MAX_LENGTH,
  CTA_CMPID_MAX_LENGTH,
  CTA_DESCRIPTION_MAX_LENGTH,
  CTA_TITLE_MAX_LENGTH,
} from "@loom/dto/constants";
import { CmsContentType, type Cta } from "@loom/dto/models";
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
  useCreateCta,
  useCta,
  useUpdateCta,
  useUpdateCtaLocale,
} from "@loom-web/src/hooks/content/useCtas";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useContextStore } from "@loom-web/src/stores/context";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CtaData = Serialized<CtaResponseDto>;

const URL_HINT = "An https URL on this site's domain, or a /path on the site";

function NewCtaForm() {
  const router = useRouter();
  const spaceId = useContextStore((state) => state.spaceId);
  const createCta = useCreateCta();

  const [url, setUrl] = useState("");
  const [cmpid, setCmpid] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");

  return (
    <NewItemForm
      error={createCta.error}
      isDisabled={!spaceId}
      isPending={createCta.isPending}
      listHref="/ctas"
      listLabel="CTAs"
      onCreate={() => {
        if (!spaceId) return;
        createCta.mutate(
          {
            spaceId,
            url,
            cmpid: cmpid || undefined,
            title,
            description,
            buttonLabel,
          },
          { onSuccess: (created) => router.push(`/ctas/${created.id}`) },
        );
      }}
      subtitle="A button block writers place inside posts. The link is the same in every language."
      title="New CTA"
    >
      <FormField
        isTitle
        label="Title"
        name="title"
        maxLength={CTA_TITLE_MAX_LENGTH}
        onChange={setTitle}
        value={title}
      />
      <FormField
        label="Description"
        name="description"
        maxLength={CTA_DESCRIPTION_MAX_LENGTH}
        multiline
        onChange={setDescription}
        value={description}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Button label"
          name="buttonLabel"
          maxLength={CTA_BUTTON_LABEL_MAX_LENGTH}
          onChange={setButtonLabel}
          placeholder="Start trading"
          value={buttonLabel}
        />
        <FormField
          hint="Optional campaign id for analytics"
          label="cmpid"
          mono
          onChange={setCmpid}
          placeholder="spring-sale"
          value={cmpid}
        />
      </div>
      <FormField
        hint={URL_HINT}
        label="Link"
        mono
        onChange={setUrl}
        placeholder="/trade-mm2"
        value={url}
      />
    </NewItemForm>
  );
}

function CtaDetails({ cta }: { cta: CtaData }) {
  const updateCta = useUpdateCta();

  const [url, setUrl] = useState(cta.url);
  const [cmpid, setCmpid] = useState(cta.cmpid ?? "");
  const [imageId, setImageId] = useState<Cta["imageId"]>(cta.imageId);

  useEditorSection({
    id: "shared",
    label: "CTA details",
    order: 0,
    values: { url, cmpid, imageId },
    save: () =>
      updateCta.mutateAsync({
        id: cta.id,
        args: { url, cmpid: cmpid || null, imageId },
      }),
  });

  return (
    <RailSection title="CTA details · every language">
      <FormField
        hint={URL_HINT}
        label="Link"
        mono
        onChange={setUrl}
        value={url}
      />
      <FormField
        label="cmpid"
        maxLength={CTA_CMPID_MAX_LENGTH}
        mono
        onChange={setCmpid}
        value={cmpid}
      />
      <ImageField
        field="cta.image"
        label="Image"
        onChange={setImageId}
        value={imageId}
      />
    </RailSection>
  );
}

/** One language of one CTA — keyed on both, so a refetch never overwrites what is typed. */
function CtaContent({
  cta,
  language,
}: {
  cta: CtaData;
  language: CtaLocaleResponseDto["languageCode"];
}) {
  const updateLocale = useUpdateCtaLocale();

  const locale = cta.locales.find(
    (candidate) => candidate.languageCode === language,
  );

  const [title, setTitle] = useState(locale?.title ?? "");
  const [description, setDescription] = useState(locale?.description ?? "");
  const [buttonLabel, setButtonLabel] = useState(locale?.buttonLabel ?? "");
  const args = { title, description, buttonLabel };

  useEditorSection({
    id: `locale:${language}`,
    label: language,
    order: 1,
    values: args,
    save: () => updateLocale.mutateAsync({ id: cta.id, language, args }),
  });

  return (
    <Section bodyClassName="gap-5 px-6 pb-6">
      <FormField
        isTitle
        label="Title"
        name="title"
        maxLength={CTA_TITLE_MAX_LENGTH}
        onChange={setTitle}
        value={title}
      />
      <FormField
        label="Description"
        name="description"
        maxLength={CTA_DESCRIPTION_MAX_LENGTH}
        multiline
        onChange={setDescription}
        value={description}
      />
      <FormField
        label="Button label"
        name="buttonLabel"
        maxLength={CTA_BUTTON_LABEL_MAX_LENGTH}
        onChange={setButtonLabel}
        value={buttonLabel}
      />
    </Section>
  );
}

export function CtaForm({ ctaId }: { ctaId?: Cta["id"] }) {
  const language = useContextStore((state) => state.languageCode);
  const { site } = useActiveSite();
  const { data: cta, error } = useCta(ctaId);
  // A restore or a translation replaces what the forms were seeded from, so they reload
  const [reloads, setReloads] = useState(0);

  if (!ctaId) return <NewCtaForm />;
  if (error) return <ErrorText message={error.message} />;
  if (!cta) return <EditorSkeleton />;

  const locale = cta.locales.find(
    (candidate) => candidate.languageCode === language,
  );
  const source = cta.locales.find(
    (candidate) => candidate.languageCode === site?.defaultLanguage,
  );

  return (
    <EditorProvider key={`${cta.id}:${language}:${reloads}`}>
      <EditorLayout
        deletedAt={cta.deletedAt}
        itemId={cta.id}
        locale={locale}
        locales={cta.locales}
        main={<CtaContent cta={cta} language={language} />}
        onReload={() => setReloads((count) => count + 1)}
        shared={
          language === site?.defaultLanguage ? (
            <CtaDetails cta={cta} />
          ) : (
            <SharedFieldsNotice fields="The link, campaign id and image" />
          )
        }
        title={locale?.title || source?.title || ""}
        type={CmsContentType.CTA}
      />
    </EditorProvider>
  );
}
