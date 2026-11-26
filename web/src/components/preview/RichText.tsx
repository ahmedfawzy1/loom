import type {
  DeliveryCtaResponseDto,
  DeliveryEntryLinkResponseDto,
  DeliveryIncludesResponseDto,
  DeliveryMediaResponseDto,
} from "@loom/dto";
import type { RichTextEntryType } from "@loom/dto/constants";
import Link from "next/link";
import { createElement, type ReactNode } from "react";

interface RichNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

type Media = Serialized<DeliveryMediaResponseDto>;
type Cta = Serialized<DeliveryCtaResponseDto>;
type Entry = Serialized<DeliveryEntryLinkResponseDto>;

/** What a body refers to, keyed for lookup — built once from the response's `includes`. */
interface Context {
  media: Map<string, Media>;
  ctas: Map<string, Cta>;
  entries: Map<string, Entry>;
  /** For CTAs that link to a /path: where readers would actually go. */
  siteDomain: string;
}

const ENTRY_PATHS: Record<RichTextEntryType, string> = {
  blog: "blogs",
  category: "categories",
  tag: "tags",
  author: "authors",
};

/** An entry's own preview page, in the language the website would link it in. */
export const previewHref = (
  entry: Pick<Entry, "type" | "id" | "languageCode">,
) =>
  `/preview/${ENTRY_PATHS[entry.type as RichTextEntryType]}/${entry.id}?language=${entry.languageCode}`;

const entryKey = (type: unknown, id: unknown) =>
  `${String(type)}:${String(id)}`;

/** A /path is on the CTA's own Site (the API checks); show it as the address readers get. */
const ctaHref = (url: string, siteDomain: string) =>
  url.startsWith("/") ? `https://${siteDomain}${url}` : url;

/**
 * What the website leaves out — a reference that is not saved in this language, or is in the Trash —
 * shown here instead of silently missing, because the preview is for the people who can fix it.
 */
function Missing({ children }: { children: ReactNode }) {
  return (
    <span className="not-prose my-4 block rounded-lg border border-border border-dashed px-3 py-2 text-muted text-xs">
      Not shown on the website: {children}
    </span>
  );
}

function CtaCard({ cta, siteDomain }: { cta: Cta; siteDomain: string }) {
  return (
    <aside className="not-prose my-8 flex flex-col overflow-hidden rounded-xl border border-border bg-surface-secondary sm:flex-row">
      {cta.image && (
        // biome-ignore lint/performance/noImgElement: a preview of the website's own markup, not an optimised Next page
        <img
          alt={cta.image.altText ?? ""}
          className="aspect-[1.9] w-full object-cover sm:w-56"
          src={cta.image.url}
        />
      )}
      <div className="flex flex-1 flex-col items-start gap-2 p-5">
        <p className="font-semibold text-base text-foreground">{cta.title}</p>
        {cta.description && (
          <p className="text-muted text-sm">{cta.description}</p>
        )}
        <a
          className="mt-1 rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground text-sm"
          href={ctaHref(cta.url, siteDomain)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {cta.buttonLabel}
        </a>
      </div>
    </aside>
  );
}

function renderText(node: RichNode, context: Context): ReactNode {
  let result: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    const attrs = mark.attrs ?? {};
    switch (mark.type) {
      case "bold":
        result = <strong>{result}</strong>;
        break;
      case "italic":
        result = <em>{result}</em>;
        break;
      case "underline":
        result = <u>{result}</u>;
        break;
      case "strike":
        result = <s>{result}</s>;
        break;
      case "code":
        result = <code>{result}</code>;
        break;
      case "subscript":
        result = <sub>{result}</sub>;
        break;
      case "superscript":
        result = <sup>{result}</sup>;
        break;
      case "link":
        result = (
          <a
            href={String(attrs.href ?? "#")}
            rel="noopener noreferrer"
            target="_blank"
          >
            {result}
          </a>
        );
        break;
      case "entryLink": {
        const entry = context.entries.get(
          entryKey(attrs.entryType, attrs.entryId),
        );
        // The website renders a link to something not live as plain text
        result = entry ? (
          <Link href={previewHref(entry)}>{result}</Link>
        ) : (
          <span
            className="underline decoration-dotted"
            title="Plain text on the website: what this links to isn't saved in this language"
          >
            {result}
          </span>
        );
        break;
      }
      case "assetLink": {
        const media = context.media.get(String(attrs.mediaId));
        result = media ? (
          <a href={media.url} rel="noopener noreferrer" target="_blank">
            {result}
          </a>
        ) : (
          result
        );
        break;
      }
    }
  }
  return result;
}

function renderNode(node: RichNode, key: string, context: Context): ReactNode {
  const children = () =>
    node.content?.map((child, index) =>
      renderNode(child, `${key}.${index}`, context),
    );
  const attrs = node.attrs ?? {};

  switch (node.type) {
    case "doc":
      return children();
    case "text":
      return <span key={key}>{renderText(node, context)}</span>;
    case "paragraph":
      return <p key={key}>{children()}</p>;
    case "heading":
      return createElement(
        `h${Math.min(Math.max(Number(attrs.level) || 2, 1), 6)}`,
        { key },
        children(),
      );
    case "bulletList":
      return <ul key={key}>{children()}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={Number(attrs.start) || undefined}>
          {children()}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children()}</li>;
    case "blockquote":
      return <blockquote key={key}>{children()}</blockquote>;
    case "horizontalRule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    case "table":
      return (
        <div className="overflow-x-auto" key={key}>
          <table>
            <tbody>{children()}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr key={key}>{children()}</tr>;
    case "tableHeader":
    case "tableCell":
      return createElement(
        node.type === "tableHeader" ? "th" : "td",
        {
          key,
          colSpan:
            Number(attrs.colspan) > 1 ? Number(attrs.colspan) : undefined,
          rowSpan:
            Number(attrs.rowspan) > 1 ? Number(attrs.rowspan) : undefined,
        },
        children(),
      );
    case "mediaEmbed": {
      const media = context.media.get(String(attrs.mediaId));
      if (!media)
        return (
          <Missing key={key}>an image that is no longer available.</Missing>
        );
      return (
        <figure key={key}>
          {/* biome-ignore lint/performance/noImgElement: a preview of the website's own markup */}
          <img
            alt={media.altText ?? ""}
            className="rounded-lg"
            height={media.height}
            src={media.url}
            width={media.width}
          />
        </figure>
      );
    }
    case "ctaEmbed": {
      const cta = context.ctas.get(String(attrs.ctaId));
      if (!cta)
        return (
          <Missing key={key}>
            a CTA with no saved version in this language, or in the Trash.
          </Missing>
        );
      return <CtaCard cta={cta} key={key} siteDomain={context.siteDomain} />;
    }
    case "entryEmbed": {
      const entry = context.entries.get(
        entryKey(attrs.entryType, attrs.entryId),
      );
      if (!entry)
        return (
          <Missing key={key}>
            an embedded {String(attrs.entryType ?? "entry")} with no saved
            version in this language.
          </Missing>
        );
      return (
        <Link
          className="not-prose my-6 block rounded-xl border border-border bg-surface-secondary px-5 py-4 transition-colors hover:border-accent"
          href={previewHref(entry)}
          key={key}
        >
          <span className="text-muted text-xs capitalize">{entry.type}</span>
          <span className="block font-semibold text-foreground">
            {entry.title}
          </span>
        </Link>
      );
    }
    case "entryInline": {
      const entry = context.entries.get(
        entryKey(attrs.entryType, attrs.entryId),
      );
      return entry ? (
        <Link href={previewHref(entry)} key={key}>
          {entry.title}
        </Link>
      ) : (
        <span className="text-muted" key={key}>
          (not shown)
        </span>
      );
    }
    default:
      // A node this renderer doesn't know yet: keep its text rather than lose it
      return <span key={key}>{children()}</span>;
  }
}

/**
 * A post body rendered from its Tiptap JSON the way a website would: every embed resolved from the
 * response's `includes`, never fetched on its own. Static content, so keys follow document position.
 */
export function RichText({
  doc,
  includes,
  siteDomain,
}: {
  doc: Record<string, unknown>;
  includes: Serialized<DeliveryIncludesResponseDto>;
  siteDomain: string;
}) {
  const context: Context = {
    media: new Map(includes.media.map((media) => [media.id, media])),
    ctas: new Map(includes.ctas.map((cta) => [cta.id, cta])),
    entries: new Map(
      includes.entries.map((entry) => [entryKey(entry.type, entry.id), entry]),
    ),
    siteDomain,
  };
  return <>{renderNode(doc as unknown as RichNode, "doc", context)}</>;
}
