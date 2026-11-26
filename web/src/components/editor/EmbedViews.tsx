"use client";

import { cn, Skeleton } from "@heroui/react";
import type { RichTextEntryType } from "@loom/dto/constants";
import type { Cta, Media } from "@loom/dto/models";
import { Pill } from "@loom-web/src/components/ui/Pill";
import { useCta } from "@loom-web/src/hooks/content/useCtas";
import { useEntryLabel } from "@loom-web/src/hooks/content/useEntryLabel";
import { useMediaItem } from "@loom-web/src/hooks/media/useMedia";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { isNotFound } from "@loom-web/src/lib/api/instance";
import { useContextStore } from "@loom-web/src/stores/context";
import {
  Article,
  FolderSimple,
  type Icon,
  ImageSquare,
  LinkSimple,
  Megaphone,
  Tag,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import type { ReactNode } from "react";

const ENTRY_ICONS: Record<RichTextEntryType, Icon> = {
  blog: Article,
  category: FolderSimple,
  tag: Tag,
  author: UserCircle,
};

/**
 * The shell every block embed renders in. It shows what is referenced rather than a live render of
 * it — the editor's job is to make the reference unmistakable and removable, and the website owns
 * how it finally looks.
 */
function EmbedCard({
  kind,
  icon: KindIcon,
  children,
  selected,
  missing,
  onRemove,
}: {
  kind: string;
  icon: Icon;
  children: ReactNode;
  selected: boolean;
  missing?: boolean;
  onRemove: () => void;
}) {
  return (
    <NodeViewWrapper
      className={cn(
        "not-prose my-4 flex items-center gap-3 rounded-lg border border-border bg-surface-secondary px-3 py-2.5",
        missing && "border-danger/40 bg-danger-soft",
        selected && "border-accent ring-2 ring-accent/25",
      )}
      contentEditable={false}
      data-drag-handle
    >
      <span className="flex w-14 shrink-0 flex-col items-center gap-1 text-muted">
        <KindIcon className="size-4" />
        <span className="font-semibold text-[10px] uppercase tracking-wide">
          {kind}
        </span>
      </span>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      <button
        aria-label={`Remove ${kind}`}
        className="rounded-md p-1.5 text-muted transition-colors duration-fast hover:bg-danger-soft hover:text-danger-soft-foreground"
        onClick={onRemove}
        title="Remove"
        type="button"
      >
        <X className="size-4" />
      </button>
    </NodeViewWrapper>
  );
}

function EmbedLoading() {
  return <Skeleton className="h-3.5 w-2/5 rounded" />;
}

/** Gone is a fact about the reference; any other failure is a fact about the connection. */
function LoadFailure({ error, what }: { error: Error | null; what: string }) {
  if (!error) return null;
  return (
    <span className="text-danger-soft-foreground">
      {isNotFound(error) ? `This ${what} no longer exists` : error.message}
    </span>
  );
}

export function CtaEmbedView({
  node,
  selected,
  deleteNode,
}: ReactNodeViewProps) {
  const language = useContextStore((state) => state.languageCode);
  const { site } = useActiveSite();
  const { data: cta, isPending, error } = useCta(node.attrs.ctaId as Cta["id"]);
  const locale =
    cta?.locales.find((candidate) => candidate.languageCode === language) ??
    cta?.locales.find(
      (candidate) => candidate.languageCode === site?.defaultLanguage,
    ) ??
    cta?.locales[0];

  return (
    <EmbedCard
      icon={Megaphone}
      kind="CTA"
      missing={Boolean(error)}
      onRemove={deleteNode}
      selected={selected}
    >
      {isPending && <EmbedLoading />}
      <LoadFailure error={error} what="CTA" />
      {locale && (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{locale.title}</span>
          <span className="flex items-center gap-1 truncate text-muted text-xs">
            <LinkSimple className="size-3 shrink-0" />
            {cta?.url}
          </span>
        </span>
      )}
    </EmbedCard>
  );
}

export function MediaEmbedView({
  node,
  selected,
  deleteNode,
}: ReactNodeViewProps) {
  const {
    data: image,
    isPending,
    error,
  } = useMediaItem(node.attrs.mediaId as Media["id"]);

  return (
    <EmbedCard
      icon={ImageSquare}
      kind="Image"
      missing={Boolean(error)}
      onRemove={deleteNode}
      selected={selected}
    >
      {isPending && <EmbedLoading />}
      <LoadFailure error={error} what="image" />
      {image && (
        <div className="flex items-center gap-3">
          {/* biome-ignore lint/performance/noImgElement: media is served from the bucket, whose origin differs per environment */}
          <img
            alt={image.altText || image.filename}
            className="h-12 w-20 shrink-0 rounded-md border border-border bg-surface object-contain"
            src={image.url}
          />
          <span className="flex min-w-0 flex-col items-start gap-1">
            <span className="max-w-full truncate font-medium">
              {image.filename}
            </span>
            {!image.altText && (
              // Alt text is what a screen reader and a search engine get for this image
              <Pill tone="warning">No alt text</Pill>
            )}
          </span>
        </div>
      )}
    </EmbedCard>
  );
}

export function EntryEmbedView({
  node,
  selected,
  deleteNode,
}: ReactNodeViewProps) {
  const type = node.attrs.entryType as RichTextEntryType;
  const { typeLabel, name, isPending, error } = useEntryLabel(
    type,
    node.attrs.entryId as string,
  );

  return (
    <EmbedCard
      icon={ENTRY_ICONS[type]}
      kind={typeLabel}
      missing={Boolean(error)}
      onRemove={deleteNode}
      selected={selected}
    >
      {isPending && <EmbedLoading />}
      <LoadFailure error={error} what={typeLabel.toLowerCase()} />
      {name && <span className="block truncate font-medium">{name}</span>}
    </EmbedCard>
  );
}

/** Inline, so it sits in running text rather than taking a block of its own. */
export function EntryInlineView({ node, selected }: ReactNodeViewProps) {
  const type = node.attrs.entryType as RichTextEntryType;
  const { name, error } = useEntryLabel(type, node.attrs.entryId as string);
  const isMissing = isNotFound(error);

  return (
    <NodeViewWrapper
      as="span"
      className={cn(
        "rounded bg-accent-soft px-1 text-accent-soft-foreground",
        isMissing && "bg-danger-soft text-danger-soft-foreground",
        selected && "ring-2 ring-accent",
      )}
      contentEditable={false}
    >
      {name ?? (isMissing ? "missing entry" : error ? "could not load" : "…")}
    </NodeViewWrapper>
  );
}
