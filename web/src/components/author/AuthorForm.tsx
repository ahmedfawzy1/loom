"use client";

import type { AuthorLocaleResponseDto, AuthorResponseDto } from "@loom/dto";
import {
  AUTHOR_BIO_MAX_LENGTH,
  AUTHOR_JOB_TITLE_MAX_LENGTH,
  AUTHOR_NAME_MAX_LENGTH,
} from "@loom/dto/constants";
import { type Author, CmsContentType } from "@loom/dto/models";
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
  useAuthor,
  useCreateAuthor,
  useUpdateAuthor,
  useUpdateAuthorLocale,
} from "@loom-web/src/hooks/content/useAuthors";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useContextStore } from "@loom-web/src/stores/context";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AuthorData = Serialized<AuthorResponseDto>;

// One URL per line rather than a comma list, which cannot swallow a comma inside a URL
const toLines = (links: Author["socialLinks"]) => links.join("\n");
const fromLines = (value: string): Author["socialLinks"] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

function NewAuthorForm() {
  const router = useRouter();
  const spaceId = useContextStore((state) => state.spaceId);
  const createAuthor = useCreateAuthor();

  const [name, setName] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [bio, setBio] = useState("");

  return (
    <NewItemForm
      error={createAuthor.error}
      isDisabled={!spaceId}
      isPending={createAuthor.isPending}
      listHref="/authors"
      listLabel="Authors"
      onCreate={() => {
        if (!spaceId) return;
        createAuthor.mutate(
          {
            spaceId,
            name,
            socialLinks: fromLines(socialLinks),
            jobTitle,
            bio,
          },
          { onSuccess: (created) => router.push(`/authors/${created.id}`) },
        );
      }}
      subtitle="The name is the same in every language; the job title and bio are translated."
      title="New author"
    >
      <FormField
        isTitle
        label="Name"
        maxLength={AUTHOR_NAME_MAX_LENGTH}
        onChange={setName}
        value={name}
      />
      <FormField
        label="Job title"
        name="jobTitle"
        maxLength={AUTHOR_JOB_TITLE_MAX_LENGTH}
        onChange={setJobTitle}
        value={jobTitle}
      />
      <FormField label="Bio" multiline onChange={setBio} rows={4} value={bio} />
      <FormField
        hint="One URL per line"
        label="Social links"
        mono
        multiline
        onChange={setSocialLinks}
        value={socialLinks}
      />
    </NewItemForm>
  );
}

function AuthorDetails({ author }: { author: AuthorData }) {
  const updateAuthor = useUpdateAuthor();

  const [name, setName] = useState(author.name);
  const [socialLinks, setSocialLinks] = useState(toLines(author.socialLinks));
  const [profileImageId, setProfileImageId] = useState<
    Author["profileImageId"]
  >(author.profileImageId);

  useEditorSection({
    id: "shared",
    label: "Author details",
    order: 0,
    values: { name, socialLinks, profileImageId },
    save: () =>
      updateAuthor.mutateAsync({
        id: author.id,
        args: { name, socialLinks: fromLines(socialLinks), profileImageId },
      }),
  });

  return (
    <RailSection title="Byline · every language">
      <ImageField
        field="author.profileImage"
        label="Profile image"
        onChange={setProfileImageId}
        value={profileImageId}
      />
      <FormField
        label="Name"
        maxLength={AUTHOR_NAME_MAX_LENGTH}
        onChange={setName}
        value={name}
      />
      <FormField
        hint="One URL per line"
        label="Social links"
        mono
        multiline
        onChange={setSocialLinks}
        value={socialLinks}
      />
    </RailSection>
  );
}

/** One language of one author — keyed on both, so a refetch never overwrites what is typed. */
function AuthorContent({
  author,
  language,
}: {
  author: AuthorData;
  language: AuthorLocaleResponseDto["languageCode"];
}) {
  const updateLocale = useUpdateAuthorLocale();

  const locale = author.locales.find(
    (candidate) => candidate.languageCode === language,
  );

  const [jobTitle, setJobTitle] = useState(locale?.jobTitle ?? "");
  const [bio, setBio] = useState(locale?.bio ?? "");
  const args = { jobTitle, bio };

  useEditorSection({
    id: `locale:${language}`,
    label: language,
    order: 1,
    values: args,
    save: () => updateLocale.mutateAsync({ id: author.id, language, args }),
  });

  return (
    <Section bodyClassName="gap-5 px-6 pb-6">
      <FormField
        label="Job title"
        name="jobTitle"
        maxLength={AUTHOR_JOB_TITLE_MAX_LENGTH}
        onChange={setJobTitle}
        placeholder="Trading editor"
        value={jobTitle}
      />
      <FormField
        label="Bio"
        name="bio"
        maxLength={AUTHOR_BIO_MAX_LENGTH}
        multiline
        onChange={setBio}
        rows={10}
        value={bio}
      />
    </Section>
  );
}

export function AuthorForm({ authorId }: { authorId?: Author["id"] }) {
  const language = useContextStore((state) => state.languageCode);
  const { site } = useActiveSite();
  const { data: author, error } = useAuthor(authorId);
  // A restore or a translation replaces what the forms were seeded from, so they reload
  const [reloads, setReloads] = useState(0);

  if (!authorId) return <NewAuthorForm />;
  if (error) return <ErrorText message={error.message} />;
  if (!author) return <EditorSkeleton />;

  return (
    <EditorProvider key={`${author.id}:${language}:${reloads}`}>
      <EditorLayout
        deletedAt={author.deletedAt}
        itemId={author.id}
        locale={author.locales.find(
          (candidate) => candidate.languageCode === language,
        )}
        locales={author.locales}
        main={<AuthorContent author={author} language={language} />}
        onReload={() => setReloads((count) => count + 1)}
        shared={
          language === site?.defaultLanguage ? (
            <AuthorDetails author={author} />
          ) : (
            <SharedFieldsNotice fields="The name, profile image and social links" />
          )
        }
        title={author.name}
        type={CmsContentType.AUTHOR}
      />
    </EditorProvider>
  );
}
