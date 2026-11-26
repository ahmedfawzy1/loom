"use client";

import { Button, cn, Input, Skeleton, TextField, toast } from "@heroui/react";
import type { MediaResponseDto } from "@loom/dto";
import { MEDIA_ALLOWED_MIME_TYPES } from "@loom/dto/constants";
import { CmsRole, type CmsUser } from "@loom/dto/models";
import { RailSection } from "@loom-web/src/components/content/editor/EditorLayout";
import { FormField } from "@loom-web/src/components/content/FormField";
import { MediaUploadButton } from "@loom-web/src/components/media/MediaUploadButton";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { PageHeader } from "@loom-web/src/components/ui/PageHeader";
import { Pill } from "@loom-web/src/components/ui/Pill";
import {
  useDeleteMedia,
  useMediaList,
  useMediaUsages,
  useReplaceMedia,
  useUpdateMedia,
} from "@loom-web/src/hooks/media/useMedia";
import { useCurrentUser } from "@loom-web/src/hooks/user/useCurrentUser";
import { useDebounced } from "@loom-web/src/hooks/util/useDebounced";
import {
  ArrowsClockwise,
  CursorClick,
  ImagesSquare,
  MagnifyingGlass,
  Trash,
} from "@phosphor-icons/react";
import { useRef, useState } from "react";

type MediaItem = Serialized<MediaResponseDto>;

// Every role uploads and replaces, only Admin and Author delete
const DELETERS: CmsUser["role"][] = [CmsRole.ADMIN, CmsRole.AUTHOR];

const PAGE_SIZE = 30;
const TILE_PLACEHOLDERS = Array.from({ length: 10 }, (_, index) => index);

const formatBytes = (bytes: MediaItem["sizeBytes"]) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

function MediaDetail({
  item,
  onDeleted,
}: {
  item: MediaItem;
  onDeleted: () => void;
}) {
  const { data: user } = useCurrentUser();
  const { data: usages } = useMediaUsages(item.id);
  const update = useUpdateMedia();
  const replace = useReplaceMedia();
  const remove = useDeleteMedia();
  const replaceInput = useRef<HTMLInputElement>(null);

  // Keyed on the image by the parent, so these seed once per selection and a refetch keeps edits
  const [filename, setFilename] = useState(item.filename);
  const [altText, setAltText] = useState(item.altText);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const canDelete = Boolean(user?.role && DELETERS.includes(user.role));

  return (
    <>
      <RailSection title="Image">
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-secondary">
          {/* biome-ignore lint/performance/noImgElement: media is served from the bucket, whose origin differs per environment */}
          <img
            alt={item.altText || item.filename}
            className="size-full object-contain"
            src={item.url}
          />
        </div>

        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted">Dimensions</dt>
            <dd className="tabular-nums">
              {item.width}×{item.height}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted">Size</dt>
            <dd className="tabular-nums">{formatBytes(item.sizeBytes)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted">Type</dt>
            <dd>{item.mimeType.replace("image/", "").toUpperCase()}</dd>
          </div>
        </dl>

        <FormField label="Filename" onChange={setFilename} value={filename} />
        <FormField
          hint={
            altText
              ? "Describe the image for screen readers and search engines."
              : "Missing. Describe the image for screen readers and search engines."
          }
          label="Alt text"
          multiline
          onChange={setAltText}
          value={altText}
        />
        <Button
          className="self-start"
          isDisabled={update.isPending}
          onPress={() =>
            update.mutate(
              { mediaId: item.id, args: { filename, altText } },
              {
                onSuccess: () => toast.success("Image saved"),
                onError: (error) => toast.danger(error.message),
              },
            )
          }
          size="sm"
        >
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </RailSection>

      <RailSection title="File">
        <input
          accept={MEDIA_ALLOWED_MIME_TYPES.join(",")}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file)
              replace.mutate(
                { mediaId: item.id, file },
                {
                  onSuccess: () => toast.success("File replaced"),
                  onError: (error) => toast.danger(error.message),
                },
              );
          }}
          ref={replaceInput}
          type="file"
        />
        <p className="text-muted text-xs leading-5">
          Replacing keeps this image everywhere it's used. The new file must fit
          every field listed below.
        </p>
        <div className="flex gap-2">
          <Button
            isDisabled={replace.isPending}
            onPress={() => replaceInput.current?.click()}
            size="sm"
            variant="secondary"
          >
            <ArrowsClockwise className="size-4" />
            {replace.isPending ? "Replacing…" : "Replace file"}
          </Button>
          {canDelete && !isConfirmingDelete && (
            <Button
              onPress={() => setIsConfirmingDelete(true)}
              size="sm"
              variant="danger-soft"
            >
              <Trash className="size-4" />
              Delete
            </Button>
          )}
        </div>
        {isConfirmingDelete && (
          <Notice
            actions={
              <>
                <Button
                  isDisabled={remove.isPending}
                  onPress={() =>
                    remove.mutate(item.id, {
                      onSuccess: () => {
                        toast.success("Image deleted");
                        onDeleted();
                      },
                      onError: (error) => toast.danger(error.message),
                    })
                  }
                  size="sm"
                  variant="danger"
                >
                  {remove.isPending ? "Deleting…" : "Delete image"}
                </Button>
                <Button
                  onPress={() => setIsConfirmingDelete(false)}
                  size="sm"
                  variant="ghost"
                >
                  Cancel
                </Button>
              </>
            }
            title="Delete this image?"
            tone="warning"
          >
            {usages?.length
              ? "It leaves the library and the pickers, but every place listed below keeps showing it."
              : "It leaves the library and the pickers."}
          </Notice>
        )}
      </RailSection>

      <RailSection title="Used in">
        {usages ? (
          <>
            <p className="text-sm">
              {usages.length === 0
                ? "Not used in current content"
                : `${usages.length} ${usages.length === 1 ? "place" : "places"} in current content`}
            </p>
            {usages.length > 0 && (
              <ul className="flex flex-col">
                {usages.map((usage) => (
                  <li
                    className="flex items-baseline justify-between gap-3 border-separator border-b py-1.5 text-xs last:border-b-0"
                    key={`${usage.field}-${usage.contentId}`}
                  >
                    <span className="min-w-0 truncate">{usage.label}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {usage.field}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted text-xs">
              Earlier versions of a post may also use it.
            </p>
          </>
        ) : (
          <Skeleton className="h-4 w-2/3 rounded" />
        )}
      </RailSection>
    </>
  );
}

export function MediaLibrary() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<MediaItem["id"] | null>(null);
  const q = useDebounced(search);

  const { data, isPending, error } = useMediaList({
    q: q || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const selected = data?.items.find((item) => item.id === selectedId);
  const isEmptyLibrary = data?.items.length === 0 && !q;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actions={
          <MediaUploadButton
            onUploaded={(uploaded) => setSelectedId(uploaded.id)}
            variant="primary"
          />
        }
        description="Every image the Sites use. Replacing a file updates it everywhere it appears."
        title="Media"
      />

      <div className="flex items-center gap-2">
        <TextField
          aria-label="Search images"
          className="relative w-72"
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
        {data && (
          <span className="ms-auto text-muted text-xs tabular-nums">
            {data.pagination.total}{" "}
            {data.pagination.total === 1 ? "image" : "images"}
          </span>
        )}
      </div>

      {error && <ErrorText message={error.message} />}

      {isEmptyLibrary ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            action={
              <MediaUploadButton
                onUploaded={(uploaded) => setSelectedId(uploaded.id)}
                variant="primary"
              />
            }
            icon={ImagesSquare}
            title="No images yet"
          >
            Upload an image to use it in posts, categories and authors.
          </EmptyState>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_22rem]">
          <div className="flex flex-col gap-4">
            {data?.items.length === 0 && (
              <div className="rounded-xl border border-border bg-surface">
                <EmptyState icon={MagnifyingGlass} title="Nothing matches">
                  No image fits that search. Try another word.
                </EmptyState>
              </div>
            )}

            <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
              {isPending &&
                TILE_PLACEHOLDERS.map((key) => (
                  <div
                    className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-1.5"
                    key={key}
                  >
                    <Skeleton className="aspect-square w-full rounded-md" />
                    <Skeleton className="mx-1 mb-1 h-3 w-3/4 rounded" />
                  </div>
                ))}
              {data?.items.map((item) => (
                <button
                  className={cn(
                    "flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-1.5 text-start transition-colors duration-fast hover:border-accent/50",
                    item.id === selectedId &&
                      "border-accent ring-2 ring-accent/25 hover:border-accent",
                  )}
                  data-row
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  type="button"
                >
                  <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-surface-secondary">
                    {/* biome-ignore lint/performance/noImgElement: media is served from the bucket, whose origin differs per environment */}
                    <img
                      alt={item.altText || item.filename}
                      className="size-full object-contain"
                      loading="lazy"
                      src={item.url}
                    />
                  </div>
                  <div className="flex min-h-5 flex-col gap-1 px-1 pb-0.5">
                    <span className="truncate text-xs">{item.filename}</span>
                    {!item.altText && <Pill tone="warning">No alt text</Pill>}
                  </div>
                </button>
              ))}
            </div>

            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted text-xs tabular-nums">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    isDisabled={page <= 1}
                    onPress={() => setPage(page - 1)}
                    size="sm"
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <Button
                    isDisabled={page >= data.pagination.totalPages}
                    onPress={() => setPage(page + 1)}
                    size="sm"
                    variant="secondary"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-19 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            {selected ? (
              <MediaDetail
                item={selected}
                key={selected.id}
                onDeleted={() => setSelectedId(null)}
              />
            ) : (
              <div className="rounded-xl border border-border bg-surface">
                <EmptyState icon={CursorClick} title="No image selected">
                  Select an image to edit its alt text, replace it or see where
                  it's used.
                </EmptyState>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
