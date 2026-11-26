"use client";

import { Button, cn, Label, ListBox, Select, toast } from "@heroui/react";
import type {
  ContentPreviewResponseDto,
  DeliveryAuthorResponseDto,
  DeliveryBlogResponseDto,
  DeliveryBlogSummaryResponseDto,
  DeliveryCategoryDetailResponseDto,
  DeliveryMediaResponseDto,
  DeliveryTagDetailResponseDto,
} from "@loom/dto";
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_PATHS,
  isPreviewable,
} from "@loom/dto/constants";
import { type CmsContentType, LocaleStatus } from "@loom/dto/models";
import {
  previewHref,
  RichText,
} from "@loom-web/src/components/preview/RichText";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { LoadingRows } from "@loom-web/src/components/ui/LoadingRows";
import { Pill } from "@loom-web/src/components/ui/Pill";
import { StatusChip } from "@loom-web/src/components/ui/StatusChip";
import { useContentPreview } from "@loom-web/src/hooks/content/useContentPreview";
import { type LocaleRef, workflow } from "@loom-web/src/lib/api/workflow";
import { useContextStore } from "@loom-web/src/stores/context";
import {
  ArrowClockwise,
  ArrowSquareOut,
  Desktop,
  DeviceMobile,
  DeviceTablet,
  Eye,
  Globe,
  PencilSimple,
  Translate,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Preview = Serialized<ContentPreviewResponseDto>;
type Media = Serialized<DeliveryMediaResponseDto>;

const TYPE_BY_PATH = new Map(
  (Object.entries(CONTENT_TYPE_PATHS) as [CmsContentType, string][]).map(
    ([type, path]) => [path, type],
  ),
);

const WIDTHS = [
  { id: "desktop", label: "Desktop", icon: Desktop, width: "72rem" },
  { id: "tablet", label: "Tablet", icon: DeviceTablet, width: "48rem" },
  { id: "phone", label: "Phone", icon: DeviceMobile, width: "24.375rem" },
] as const;
type WidthId = (typeof WIDTHS)[number]["id"];

/** Dates the way the content's own language writes them; an unknown code falls back quietly. */
const formatIn = (language: string, value: string) => {
  try {
    return new Intl.DateTimeFormat(language, { dateStyle: "long" }).format(
      new Date(value),
    );
  } catch {
    return new Date(value).toLocaleDateString();
  }
};

/**
 * What the website shows for this language now, said plainly — the one thing an editor most needs
 * to know about a preview is how far it is from what readers see.
 */
function StatusBanner({ locale }: { locale: Preview["locales"][number] }) {
  const message = (() => {
    switch (locale.status) {
      case LocaleStatus.PUBLISHED:
        return null;
      case LocaleStatus.CHANGED:
        return "Unpublished changes. The website still shows the version published before them.";
      case LocaleStatus.IN_REVIEW:
        return locale.isLive
          ? "In review. The website still shows the published version."
          : "In review. This isn't on the website yet.";
      case LocaleStatus.UNPUBLISHED:
        return "Unpublished. This isn't on the website.";
      default:
        return "Draft. This isn't on the website yet.";
    }
  })();
  if (!message) return null;
  return (
    <div className="border-border border-b bg-warning-soft px-4 py-2 text-center text-warning-soft-foreground text-xs">
      {message}
    </div>
  );
}

function Avatar({
  name,
  image,
  size = "size-10",
}: {
  name: string;
  image: Media | null;
  size?: string;
}) {
  if (image)
    return (
      // biome-ignore lint/performance/noImgElement: a preview of the website's own markup
      <img
        alt={image.altText ?? name}
        className={cn(size, "shrink-0 rounded-full object-cover")}
        src={image.url}
      />
    );
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={cn(
        size,
        "flex shrink-0 items-center justify-center rounded-full bg-surface-tertiary font-semibold text-muted text-xs",
      )}
    >
      {initials}
    </span>
  );
}

function PostList({
  posts,
  language,
}: {
  posts: Serialized<DeliveryBlogSummaryResponseDto>[];
  language: string;
}) {
  if (!posts.length)
    return (
      <p className="text-muted text-sm">
        No posts here yet, published or saved.
      </p>
    );
  return (
    <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
      {posts.map((post) => (
        <li key={post.id}>
          <Link
            className="group flex flex-col gap-2"
            href={previewHref({ type: "blog", ...post })}
          >
            {post.image && (
              // biome-ignore lint/performance/noImgElement: a preview of the website's own markup
              <img
                alt={post.image.altText ?? ""}
                className="aspect-[1.9] w-full rounded-lg object-cover"
                src={post.image.url}
              />
            )}
            {post.category && (
              <span className="font-medium text-accent text-xs">
                {post.category.title}
              </span>
            )}
            <span className="font-semibold text-lg leading-snug group-hover:underline">
              {post.title}
            </span>
            <span className="line-clamp-2 text-muted text-sm">
              {post.description}
            </span>
            <span className="text-muted text-xs">
              {post.author?.name && `${post.author.name} · `}
              {formatIn(language, post.firstPublishedAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function BlogArticle({
  blog,
  preview,
  isLive,
}: {
  blog: Serialized<DeliveryBlogResponseDto>;
  preview: Preview;
  isLive: boolean;
}) {
  return (
    <article className="mx-auto max-w-[70ch]">
      {blog.category && (
        <Link
          className="font-medium text-accent text-sm"
          href={previewHref({ type: "category", ...blog.category })}
        >
          {blog.category.title}
        </Link>
      )}
      <h1 className="mt-2 text-balance font-semibold text-3xl leading-tight sm:text-4xl">
        {blog.title}
      </h1>
      <p className="mt-3 text-lg text-muted">{blog.description}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-border border-y py-4">
        {blog.author && (
          <Link
            className="flex items-center gap-3"
            href={previewHref({ type: "author", ...blog.author })}
          >
            <Avatar image={blog.author.profileImage} name={blog.author.name} />
            <span className="flex flex-col">
              <span className="font-medium text-sm">{blog.author.name}</span>
              {blog.author.jobTitle && (
                <span className="text-muted text-xs">
                  {blog.author.jobTitle}
                </span>
              )}
            </span>
          </Link>
        )}
        <span className="ms-auto flex flex-col items-end text-end text-muted text-xs">
          <span>
            {isLive ? "Published " : "Last saved "}
            {formatIn(
              preview.languageCode,
              isLive ? blog.firstPublishedAt : blog.publishedAt,
            )}
          </span>
          {blog.reviewer && <span>Reviewed by {blog.reviewer.name}</span>}
        </span>
      </div>
      {blog.updateNote && (
        <p className="mt-3 text-muted text-xs">Updated: {blog.updateNote}</p>
      )}

      {blog.image && (
        // biome-ignore lint/performance/noImgElement: a preview of the website's own markup
        <img
          alt={blog.image.altText ?? ""}
          className="mt-8 w-full rounded-xl"
          height={blog.image.height}
          src={blog.image.url}
          width={blog.image.width}
        />
      )}

      {blog.summary && (
        <div className="mt-8 rounded-lg border-accent border-s-4 bg-surface-secondary px-4 py-3">
          <p className="font-semibold text-muted text-xs uppercase tracking-wide">
            Summary
          </p>
          <p className="mt-1 text-sm">{blog.summary}</p>
        </div>
      )}

      {/* Typography's backticks around inline code are its own decoration, not the website's */}
      <div className="prose prose-code:before:content-none prose-code:after:content-none mt-8 max-w-none">
        <RichText
          doc={blog.body}
          includes={blog.includes}
          siteDomain={preview.siteDomain}
        />
      </div>

      {blog.faq.length > 0 && (
        <section className="mt-12">
          <h2 className="font-semibold text-xl">Frequently asked questions</h2>
          <div className="mt-4 divide-y divide-border border-border border-y">
            {blog.faq.map((item) => (
              <details className="group py-3" key={item.question}>
                <summary className="cursor-pointer font-medium">
                  {item.question}
                </summary>
                <p className="mt-2 whitespace-pre-line text-muted text-sm">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {blog.tags.length > 0 && (
        <ul className="mt-10 flex flex-wrap gap-2">
          {blog.tags.map((tag) => (
            <li key={tag.id}>
              <Link
                className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent"
                href={previewHref({ type: "tag", ...tag })}
              >
                #{tag.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function CollectionPage({
  kind,
  item,
  preview,
}: {
  kind: "category" | "tag";
  item:
    | Serialized<DeliveryCategoryDetailResponseDto>
    | Serialized<DeliveryTagDetailResponseDto>;
  preview: Preview;
}) {
  const seo =
    "seoMetaTitle" in item
      ? {
          title: item.seoMetaTitle || item.title,
          description: item.seoMetaDescription || item.description,
        }
      : null;
  return (
    <div className="mx-auto max-w-5xl">
      {item.featuredImage && (
        // biome-ignore lint/performance/noImgElement: a preview of the website's own markup
        <img
          alt={item.featuredImage.altText ?? ""}
          className="mb-8 w-full rounded-xl"
          src={item.featuredImage.url}
        />
      )}
      <p className="font-medium text-accent text-sm capitalize">{kind}</p>
      <h1 className="mt-1 font-semibold text-3xl sm:text-4xl">{item.title}</h1>
      <p className="mt-3 max-w-[65ch] text-lg text-muted">{item.description}</p>

      {seo && (
        <div className="mt-8 max-w-xl rounded-lg border border-border bg-surface p-4">
          <p className="text-muted text-xs">
            How it may look in search results
          </p>
          <p className="mt-2 truncate text-muted text-xs">
            {preview.siteDomain} › {kind} › {item.slug}
          </p>
          <p className="truncate text-accent text-lg">{seo.title}</p>
          <p className="line-clamp-2 text-muted text-sm">{seo.description}</p>
        </div>
      )}

      <h2 className="mt-12 mb-6 font-semibold text-xl">Posts</h2>
      <PostList language={preview.languageCode} posts={preview.posts} />
    </div>
  );
}

function AuthorPage({
  author,
  preview,
}: {
  author: Serialized<DeliveryAuthorResponseDto>;
  preview: Preview;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Avatar image={author.profileImage} name={author.name} size="size-24" />
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-3xl">{author.name}</h1>
          {author.jobTitle && <p className="text-muted">{author.jobTitle}</p>}
          {author.socialLinks.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-3">
              {author.socialLinks.map((link) => (
                <li key={link}>
                  <a
                    className="text-accent text-sm"
                    href={link}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {new URL(link).hostname.replace(/^www\./, "")}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {author.bio && (
        <p className="mt-6 max-w-[65ch] whitespace-pre-line">{author.bio}</p>
      )}
      <h2 className="mt-12 mb-6 font-semibold text-xl">Posts</h2>
      <PostList language={preview.languageCode} posts={preview.posts} />
    </div>
  );
}

function PreviewBody({
  preview,
  onLanguage,
}: {
  preview: Preview;
  onLanguage: (language: string) => void;
}) {
  const locale = preview.locales.find(
    (candidate) => candidate.languageCode === preview.languageCode,
  );
  if (preview.blog)
    return (
      <BlogArticle
        blog={preview.blog}
        isLive={Boolean(locale?.isLive)}
        preview={preview}
      />
    );
  if (preview.category)
    return (
      <CollectionPage
        item={preview.category}
        kind="category"
        preview={preview}
      />
    );
  if (preview.tag)
    return <CollectionPage item={preview.tag} kind="tag" preview={preview} />;
  if (preview.author)
    return <AuthorPage author={preview.author} preview={preview} />;

  return (
    <EmptyState
      icon={Translate}
      title={`Not written in ${preview.languageName} yet`}
    >
      <span className="flex flex-col items-center gap-3">
        {preview.locales.length
          ? "Preview a language it has been saved in:"
          : "Save it in the editor first."}
        <span className="flex flex-wrap justify-center gap-2">
          {preview.locales.map((saved) => (
            <Button
              key={saved.languageCode}
              onPress={() => onLanguage(saved.languageCode)}
              size="sm"
              variant="secondary"
            >
              {saved.nativeName}
            </Button>
          ))}
        </span>
      </span>
    </EmptyState>
  );
}

/**
 * The editor's Preview: one item in one language as a website would render it from the Content API
 * in draft mode — latest saved version, references resolved — on its own page, outside the admin
 * chrome. It needs no website: Loom renders it. A Site with a preview URL can also open its real
 * website from here.
 */
export function ContentPreview({
  typePath,
  id,
}: {
  typePath: string;
  id: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeLanguage = useContextStore((state) => state.languageCode);
  const setLanguage = useContextStore((state) => state.setLanguage);
  // `?view=` too, so a preview can be shared at the width it was checked at
  const [width, setWidth] = useState<WidthId>(() => {
    const view = searchParams.get("view");
    return WIDTHS.some((option) => option.id === view)
      ? (view as WidthId)
      : "desktop";
  });
  const [isOpening, setIsOpening] = useState(false);

  const type = TYPE_BY_PATH.get(typePath);
  const language = searchParams.get("language") ?? storeLanguage;
  const ref: LocaleRef | undefined =
    type && isPreviewable(type) ? { type, id, language } : undefined;
  const {
    data: preview,
    isPending,
    error,
    refetch,
    isFetching,
  } = useContentPreview(ref);

  const title =
    preview?.blog?.title ??
    preview?.category?.title ??
    preview?.tag?.title ??
    preview?.author?.name ??
    "Preview";
  useEffect(() => {
    document.title = `Preview: ${title} · Loom`;
  }, [title]);

  if (!ref)
    return (
      <div className="p-10">
        <ErrorText message="There is nothing to preview at this address." />
      </div>
    );

  const addressOf = (code: string, view: WidthId) =>
    `/preview/${typePath}/${id}?language=${code}${view === "desktop" ? "" : `&view=${view}`}`;
  const switchLanguage = (code: string) =>
    router.replace(addressOf(code, width));
  const switchWidth = (view: WidthId) => {
    setWidth(view);
    router.replace(addressOf(language, view), { scroll: false });
  };
  const locale = preview?.locales.find(
    (candidate) => candidate.languageCode === language,
  );

  const openWebsite = async () => {
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    setIsOpening(true);
    try {
      const { url } = await workflow.previewLink(ref);
      if (tab) tab.location.href = url;
      else window.open(url, "_blank", "noopener");
    } catch (failure) {
      tab?.close();
      toast.danger(
        failure instanceof Error
          ? failure.message
          : "Failed to open the website",
      );
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-secondary">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-border border-b bg-background px-4 py-2.5">
        <Pill tone="accent">
          <Eye className="me-1 inline size-3.5" />
          Preview
        </Pill>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-sm">{title}</span>
          <span className="truncate text-muted text-xs">
            {preview?.siteName ?? "…"} · {CONTENT_TYPE_LABELS[ref.type]} ·
            Latest saved version
          </span>
        </div>

        {/* On a phone the page already is phone-width, so the choice only appears where it means something */}
        <fieldset
          aria-label="Page width"
          className="hidden rounded-lg border border-border p-0.5 sm:flex"
        >
          {WIDTHS.map((option) => (
            <Button
              aria-label={option.label}
              aria-pressed={width === option.id}
              className={cn(width === option.id && "bg-surface-tertiary")}
              isIconOnly
              key={option.id}
              onPress={() => switchWidth(option.id)}
              size="sm"
              variant="ghost"
            >
              <option.icon className="size-4" />
            </Button>
          ))}
        </fieldset>

        {preview && preview.locales.length > 0 && (
          <Select
            aria-label="Language"
            className="w-44"
            onChange={(key) => {
              const selected = Array.isArray(key) ? key[0] : key;
              if (selected) switchLanguage(String(selected));
            }}
            value={locale ? language : null}
          >
            <Label className="sr-only">Language</Label>
            <Select.Trigger>
              <Select.Value className="text-sm">
                {preview.languageName}
              </Select.Value>
              <Select.Indicator className="text-muted" />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {preview.locales.map((saved) => (
                  <ListBox.Item
                    id={saved.languageCode}
                    key={saved.languageCode}
                    textValue={saved.nativeName}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      {saved.nativeName}
                      <StatusChip status={saved.status} />
                    </span>
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        )}
        {locale && <StatusChip status={locale.status} />}

        <Button
          aria-label="Refresh"
          isDisabled={isFetching}
          isIconOnly
          onPress={() => refetch()}
          size="sm"
          variant="ghost"
        >
          <ArrowClockwise
            className={cn("size-4", isFetching && "animate-spin")}
          />
        </Button>
        {preview?.hasWebsitePreview && (
          <Button
            isDisabled={isOpening || !locale}
            onPress={openWebsite}
            size="sm"
            variant="secondary"
          >
            <Globe className="size-4" />
            Open on website
            <ArrowSquareOut className="size-3.5" />
          </Button>
        )}
        <Button
          onPress={() => {
            // The editor works in the language chosen in the CMS, so carry this one over
            setLanguage(language);
            router.push(`/${typePath}/${id}`);
          }}
          size="sm"
        >
          <PencilSimple className="size-4" />
          Edit
        </Button>
      </header>

      {locale && <StatusBanner locale={locale} />}

      <main className="flex flex-1 justify-center px-4 py-8">
        <div
          className="w-full rounded-xl border border-border bg-background px-5 py-10 shadow-sm transition-[max-width] duration-300 sm:px-10"
          dir={preview?.rtl ? "rtl" : "ltr"}
          lang={language}
          style={{
            maxWidth: WIDTHS.find((option) => option.id === width)?.width,
          }}
        >
          {isPending ? (
            <LoadingRows rows={8} />
          ) : error ? (
            <ErrorText message={error.message} />
          ) : (
            <PreviewBody onLanguage={switchLanguage} preview={preview} />
          )}
        </div>
      </main>
    </div>
  );
}
