"use client";

import {
  Button,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
  toast,
} from "@heroui/react";
import type { SiteResponseDto } from "@loom/dto";
import { SLUG_PATTERN } from "@loom/dto/constants";
import { DEFAULT_SITE_LANGUAGES, type Site } from "@loom/dto/models";
import { FormField } from "@loom-web/src/components/content/FormField";
import { SettingsPanel } from "@loom-web/src/components/settings/SettingsPanel";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { Section } from "@loom-web/src/components/ui/Section";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import {
  useCreateSite,
  useDeleteSite,
  useSites,
  useUpdateSite,
} from "@loom-web/src/hooks/site/useSiteQueries";
import { useContextStore } from "@loom-web/src/stores/context";
import { Key, Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";

// The API's limits for a new Site (CreateSiteRequestDto)
const SITE_NAME_MAX_LENGTH = 60;
const SITE_SLUG_MAX_LENGTH = 50;

/** A secret long enough that guessing it is not a way to make the website rebuild itself. */
const generateSecret = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** "Acme Blog" → "acme-blog": accents dropped, anything else between words becomes one dash. */
const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SITE_SLUG_MAX_LENGTH)
    .replace(/-+$/, "");

/** Keyed on the Site, so switching Site reloads it and a refetch after saving does not. */
function SiteForm({ site }: { site: Serialized<SiteResponseDto> }) {
  const updateSite = useUpdateSite();

  const [name, setName] = useState<Site["name"]>(site.name);
  const [domain, setDomain] = useState<Site["domain"]>(site.domain);
  const [revalidateUrl, setRevalidateUrl] = useState<
    NonNullable<Site["revalidateUrl"]>
  >(site.revalidateUrl ?? "");
  // Write-only: the API never sends the stored one back, so this only ever holds a replacement
  const [secret, setSecret] =
    useState<NonNullable<Site["revalidateSecret"]>>("");
  const [previewUrl, setPreviewUrl] = useState<NonNullable<Site["previewUrl"]>>(
    site.previewUrl ?? "",
  );

  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Section title="Site">
          <FormField label="Name" onChange={setName} value={name} />
          <FormField
            label="Domain"
            onChange={setDomain}
            placeholder="example.com"
            value={domain}
          />
          <Notice>
            The slug is <span className="font-mono">{site.slug}</span> and the
            default language is{" "}
            <span className="font-mono">{site.defaultLanguage}</span>. Websites
            ask for content by the slug, and every translation is based on the
            default language, so neither can be changed.
          </Notice>
        </Section>

        <Section
          description="Where publishing tells the website which pages to rebuild."
          title="Refresh endpoint"
        >
          <FormField
            label="Endpoint URL"
            mono
            onChange={setRevalidateUrl}
            placeholder="https://example.com/api/cms-revalidate"
            value={revalidateUrl}
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <FormField
                  label="Secret"
                  mono
                  onChange={setSecret}
                  placeholder={
                    site.hasRevalidateSecret
                      ? "Set. Type or generate one to replace it"
                      : "Not set"
                  }
                  value={secret}
                />
              </div>
              <Button
                onPress={() => setSecret(generateSecret())}
                variant="secondary"
              >
                <Key className="size-4" />
                Generate
              </Button>
            </div>
            <span className="text-muted text-xs">
              Sent in the <code className="font-mono">secret</code> header. Give
              the website the same value; it is only shown while you set it.
            </span>
          </div>
        </Section>

        <Section
          description="Where the editor's Preview button opens a draft on the website."
          title="Draft preview"
        >
          <FormField
            hint="The website's route that turns on draft mode. Loom adds ?token=…, which the website resolves with a key that can read drafts. Leave empty to turn Preview off."
            label="Preview URL"
            mono
            onChange={setPreviewUrl}
            placeholder="https://example.com/api/preview"
            value={previewUrl}
          />
        </Section>
      </div>

      <div className="flex justify-end">
        <Button
          isDisabled={updateSite.isPending}
          onPress={() =>
            updateSite.mutate(
              {
                siteId: site.id,
                args: {
                  name,
                  domain,
                  revalidateUrl: revalidateUrl || null,
                  ...(secret ? { revalidateSecret: secret } : {}),
                  previewUrl: previewUrl.trim() || null,
                },
              },
              {
                onSuccess: () => toast.success("Site saved"),
                onError: (error) => toast.danger(error.message),
              },
            )
          }
        >
          {updateSite.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </>
  );
}

/** Rendered whether or not any Site exists yet, since this is how the first one gets made. */
function CreateSite() {
  const createSite = useCreateSite();
  const setSite = useContextStore((state) => state.setSite);

  const [name, setName] = useState<Site["name"]>("");
  const [domain, setDomain] = useState<Site["domain"]>("");
  // Follows the name until someone types a slug of their own; clearing it hands it back
  const [customSlug, setCustomSlug] = useState<Site["slug"] | null>(null);
  const [defaultLanguage, setDefaultLanguage] =
    useState<Site["defaultLanguage"]>("en");

  const slug = customSlug ?? slugify(name);
  const slugProblem =
    slug && !SLUG_PATTERN.test(slug)
      ? "Only lowercase letters and numbers, with single dashes between words"
      : null;
  const canCreate =
    !createSite.isPending &&
    Boolean(name.trim()) &&
    Boolean(slug) &&
    !slugProblem &&
    Boolean(domain.trim());

  const reset = () => {
    setName("");
    setDomain("");
    setCustomSlug(null);
    setDefaultLanguage("en");
  };

  return (
    <Section
      description="A new site starts with every language enabled and a Production space, ready to write in."
      title="New site"
    >
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <FormField
          label="Name"
          maxLength={SITE_NAME_MAX_LENGTH}
          onChange={setName}
          placeholder="Acme Blog"
          value={name}
        />
        <FormField
          hint="CTAs on this site may only link here, its subdomains, or a /path."
          label="Domain"
          onChange={setDomain}
          placeholder="example.com"
          value={domain}
        />
        <FormField
          hint={
            slugProblem ??
            "Websites ask for content by it: /content/<slug>/… It can't be changed later."
          }
          label="Slug"
          maxLength={SITE_SLUG_MAX_LENGTH}
          mono
          onChange={(value) => setCustomSlug(value === "" ? null : value)}
          placeholder="acme-blog"
          value={slug}
        />
        <div className="flex flex-col gap-1.5">
          <Select
            className="flex flex-col gap-1.5"
            onChange={(key) => {
              const selected = Array.isArray(key) ? key[0] : key;
              if (selected) setDefaultLanguage(String(selected));
            }}
            value={defaultLanguage}
          >
            <Label className="font-medium text-[13px]">Default language</Label>
            <Select.Trigger>
              <Select.Value className="text-sm" />
              <Select.Indicator className="text-muted" />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {DEFAULT_SITE_LANGUAGES.map((language) => (
                  <ListBox.Item
                    id={language.code}
                    key={language.code}
                    textValue={language.label}
                  >
                    {language.label}{" "}
                    <span className="font-mono text-muted text-xs">
                      {language.code}
                    </span>
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <span className="text-muted text-xs">
            What content is written in first, and translated from. It can't be
            changed later.
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          isDisabled={!canCreate}
          onPress={() =>
            createSite.mutate(
              {
                name: name.trim(),
                slug,
                domain: domain.trim(),
                defaultLanguage,
              },
              {
                onSuccess: (site) => {
                  reset();
                  // Straight into the new Site, so the next thing anyone does is set it up
                  const space = site.spaces[0];
                  if (space) setSite(site.id, space.id);
                  toast.success(
                    `${site.name} created. You're now working in it`,
                  );
                },
                onError: (error) => toast.danger(error.message),
              },
            )
          }
        >
          <Plus className="size-4" weight="bold" />
          {createSite.isPending ? "Creating…" : "Create site"}
        </Button>
      </div>
    </Section>
  );
}

function DeleteSite({
  site,
  otherSite,
}: {
  site: Serialized<SiteResponseDto>;
  /** Where to go once this one is gone; none means this is the only Site. */
  otherSite: Serialized<SiteResponseDto> | undefined;
}) {
  const deleteSite = useDeleteSite();
  const setSite = useContextStore((state) => state.setSite);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState<Site["name"]>("");

  const spaces = `${site.spaces.length} space${site.spaces.length === 1 ? "" : "s"}`;

  return (
    <Section title="Delete site">
      {!otherSite ? (
        <p className="text-muted text-sm">
          {site.name} is the only site, and Loom always keeps one. Create
          another site before deleting this one.
        </p>
      ) : !isDeleting ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[70ch] text-muted text-sm">
            Permanently removes {site.name}: its {spaces} with every post,
            category, tag, author and CTA in them, its languages and its API
            keys. Images stay in the media library.
          </p>
          <Button
            onPress={() => setIsDeleting(true)}
            size="sm"
            variant="danger-soft"
          >
            <Trash className="size-4" />
            Delete {site.name}
          </Button>
        </div>
      ) : (
        <Notice
          actions={
            <>
              <Button
                isDisabled={deleteSite.isPending || confirmName !== site.name}
                onPress={() =>
                  deleteSite.mutate(
                    { siteId: site.id, confirmName },
                    {
                      onSuccess: () => {
                        const space = otherSite.spaces[0];
                        if (space) setSite(otherSite.id, space.id);
                        toast.success(`${site.name} deleted`);
                      },
                      onError: (error) => toast.danger(error.message),
                    },
                  )
                }
                size="sm"
                variant="danger"
              >
                {deleteSite.isPending ? "Deleting…" : "Delete permanently"}
              </Button>
              <Button
                onPress={() => {
                  setIsDeleting(false);
                  setConfirmName("");
                }}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </>
          }
          title={`Delete ${site.name} and everything in it?`}
          tone="warning"
        >
          <p>
            Its {spaces}, all their content and history, its languages and its
            API keys go for good, and websites using those keys stop getting
            content at once. This can't be undone.
          </p>
          <TextField
            className="mt-2 flex max-w-xs flex-col gap-1.5"
            onChange={setConfirmName}
            value={confirmName}
          >
            <Label className="text-[13px]">Type “{site.name}” to confirm</Label>
            <Input />
          </TextField>
        </Notice>
      )}
    </Section>
  );
}

export function SitesPanel() {
  const { site } = useActiveSite();
  const { data: sites } = useSites();

  return (
    <>
      <SettingsPanel>
        {(active) => <SiteForm key={active.id} site={active} />}
      </SettingsPanel>
      <CreateSite />
      {site && (
        <DeleteSite
          key={site.id}
          otherSite={sites?.find((candidate) => candidate.id !== site.id)}
          site={site}
        />
      )}
    </>
  );
}
