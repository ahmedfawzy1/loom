"use client";

import { Button, cn, Input, Modal, Skeleton, TextField } from "@heroui/react";
import type { MediaResponseDto } from "@loom/dto";
import {
  IMAGE_FIELD_RULES,
  type ImageField,
  imageViolation,
} from "@loom/dto/constants";
import { MediaUploadButton } from "@loom-web/src/components/media/MediaUploadButton";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { Pill } from "@loom-web/src/components/ui/Pill";
import { useMediaList } from "@loom-web/src/hooks/media/useMedia";
import { useDebounced } from "@loom-web/src/hooks/util/useDebounced";
import { ImagesSquare, MagnifyingGlass } from "@phosphor-icons/react";
import { useState } from "react";

type MediaItem = Serialized<MediaResponseDto>;

const TILE_PLACEHOLDERS = Array.from({ length: 10 }, (_, index) => index);

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPick: (media: MediaItem) => void;
  /**
   * The field being filled. Images that break its rule are shown but not pickable, with the reason
   * — the same rule the API enforces, so the picker never offers something that is then refused.
   */
  field?: ImageField;
}

function MediaTile({
  item,
  violation,
  onPick,
}: {
  item: MediaItem;
  violation: string | null;
  onPick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-1.5 text-start transition-colors duration-fast",
        violation
          ? "cursor-not-allowed opacity-45"
          : "hover:border-accent hover:bg-accent-soft focus-visible:border-accent focus-visible:bg-accent-soft",
      )}
      data-row
      disabled={Boolean(violation)}
      onClick={onPick}
      title={violation ? `Can't use here: ${violation}` : item.filename}
      type="button"
    >
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-surface-secondary">
        {/* A plain img: media is served straight from the bucket, whose origin differs per
            environment, so next/image would need a remotePatterns entry for each */}
        {/* biome-ignore lint/performance/noImgElement: see above */}
        <img
          alt={item.altText || item.filename}
          className="size-full object-contain"
          loading="lazy"
          src={item.url}
        />
      </div>
      <div className="flex flex-col gap-0.5 px-1 pb-0.5">
        <span className="truncate text-xs">{item.filename}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted tabular-nums">
          {item.width}×{item.height}
          {!item.altText && (
            <Pill dot={false} tone="warning">
              No alt
            </Pill>
          )}
        </span>
      </div>
    </button>
  );
}

export function MediaLibraryModal({
  isOpen,
  onClose,
  onPick,
  field,
}: MediaLibraryModalProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);

  const { data, isPending, error } = useMediaList({
    q: q || undefined,
    page,
    pageSize: 24,
  });

  const pick = (item: MediaItem) => {
    onPick(item);
    onClose();
  };

  const violationOf = (item: MediaItem) =>
    field ? imageViolation(item, IMAGE_FIELD_RULES[field]) : null;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container className="w-full" placement="center">
        <Modal.Dialog className="max-w-4xl rounded-xl p-0">
          <Modal.CloseTrigger />
          <Modal.Header className="border-border border-b px-5 py-4">
            <Modal.Heading className="font-semibold text-base">
              Choose an image
            </Modal.Heading>
            {field && IMAGE_FIELD_RULES[field].shape !== "any" && (
              <p className="text-muted text-sm">
                Images that don't fit this field are faded. Hover one to see
                why.
              </p>
            )}
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-3 px-5 py-4">
            <div className="flex items-center gap-2">
              <TextField
                aria-label="Search images"
                className="relative flex-1"
                onChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                value={search}
              >
                <MagnifyingGlass className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input
                  className="h-8 ps-8 text-sm"
                  placeholder="Search by filename or alt text"
                  type="search"
                />
              </TextField>
              {/* A fresh upload is picked immediately — that is almost always why it was uploaded */}
              <MediaUploadButton
                onUploaded={(uploaded) => {
                  if (!violationOf(uploaded)) pick(uploaded);
                }}
              />
            </div>

            {error && <ErrorText message={error.message} />}

            <div className="h-[55vh] overflow-y-auto pe-1">
              {data?.items.length === 0 ? (
                <EmptyState
                  icon={q ? MagnifyingGlass : ImagesSquare}
                  title={q ? "Nothing matches" : "No images yet"}
                >
                  {q
                    ? "No image fits that search."
                    : "Upload the first image to use it here."}
                </EmptyState>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2.5">
                  {isPending &&
                    TILE_PLACEHOLDERS.map((key) => (
                      <div
                        className="flex flex-col gap-2 rounded-lg border border-border p-1.5"
                        key={key}
                      >
                        <Skeleton className="aspect-square w-full rounded-md" />
                        <Skeleton className="mx-1 mb-1 h-3 w-3/4 rounded" />
                      </div>
                    ))}
                  {data?.items.map((item) => (
                    <MediaTile
                      item={item}
                      key={item.id}
                      onPick={() => pick(item)}
                      violation={violationOf(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          </Modal.Body>

          <Modal.Footer className="flex-row items-center gap-2 border-border border-t px-5 py-3">
            {data && data.pagination.totalPages > 1 && (
              <>
                <span className="text-muted text-xs tabular-nums">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </span>
                <Button
                  isDisabled={page <= 1}
                  onPress={() => setPage(page - 1)}
                  size="sm"
                  variant="ghost"
                >
                  Previous
                </Button>
                <Button
                  isDisabled={page >= data.pagination.totalPages}
                  onPress={() => setPage(page + 1)}
                  size="sm"
                  variant="ghost"
                >
                  Next
                </Button>
              </>
            )}
            <Button className="ms-auto" onPress={onClose} variant="secondary">
              Cancel
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
