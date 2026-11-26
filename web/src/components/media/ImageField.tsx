"use client";

import { Button, Skeleton } from "@heroui/react";
import {
  IMAGE_FIELD_RULES,
  type ImageField as ImageFieldName,
} from "@loom/dto/constants";
import type { Media } from "@loom/dto/models";
import { MediaLibraryModal } from "@loom-web/src/components/media/MediaLibraryModal";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { useMediaItem } from "@loom-web/src/hooks/media/useMedia";
import { ImageSquare, X } from "@phosphor-icons/react";
import { useState } from "react";

/** The rule a field carries, said in words, so an editor knows before they pick. */
function ruleHint(field: ImageFieldName): string | null {
  const rule = IMAGE_FIELD_RULES[field];
  const parts: string[] = [];
  if (rule.shape === "landscape") parts.push("Landscape");
  if (rule.shape === "square") parts.push("Square");
  if ("minWidth" in rule && rule.minWidth)
    parts.push(`at least ${rule.minWidth}×${rule.minHeight}`);
  return parts.length ? parts.join(", ") : null;
}

export function ImageField({
  label,
  field,
  value,
  onChange,
}: {
  label: string;
  field: ImageFieldName;
  value: Media["id"] | null;
  /** null clears the field. */
  onChange: (mediaId: Media["id"] | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: image, isPending } = useMediaItem(value);
  const hint = ruleHint(field);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-[13px]">{label}</span>
        {hint && <span className="text-muted text-xs">{hint}</span>}
      </div>

      {value ? (
        <div className="flex flex-col gap-2">
          <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-secondary">
            {isPending && <Skeleton className="size-full" />}
            {image && (
              // biome-ignore lint/performance/noImgElement: media is served from the bucket, whose origin differs per environment
              <img
                alt={image.altText || image.filename}
                className="size-full object-contain"
                src={image.url}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            {image && (
              <span className="min-w-0 flex-1 truncate text-xs">
                {image.filename}
                <span className="ms-1.5 text-muted tabular-nums">
                  {image.width}×{image.height}
                </span>
              </span>
            )}
            <Button
              className="ms-auto"
              onPress={() => setIsOpen(true)}
              size="sm"
              variant="secondary"
            >
              Change
            </Button>
            <Button
              aria-label={`Remove ${label.toLowerCase()}`}
              isIconOnly
              onPress={() => onChange(null)}
              size="sm"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          </div>
          {image?.deletedAt && (
            <Notice tone="warning">
              Deleted from the library. It still shows here until you change it.
            </Notice>
          )}
        </div>
      ) : (
        <button
          className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-border border-dashed bg-surface-secondary text-muted text-sm transition-colors duration-fast hover:border-accent/50 hover:text-foreground"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <ImageSquare className="size-6" />
          Choose an image
        </button>
      )}

      <MediaLibraryModal
        field={field}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onPick={(picked) => onChange(picked.id)}
      />
    </div>
  );
}
