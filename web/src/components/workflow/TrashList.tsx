"use client";

import { Button, toast } from "@heroui/react";
import type { TrashItemResponseDto } from "@loom/dto";
import { CONTENT_TYPE_LABELS, CONTENT_TYPE_PATHS } from "@loom/dto/constants";
import { CmsRole } from "@loom/dto/models";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { LoadingRows } from "@loom-web/src/components/ui/LoadingRows";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { PageHeader } from "@loom-web/src/components/ui/PageHeader";
import { Section } from "@loom-web/src/components/ui/Section";
import {
  usePurgeItem,
  useRestoreItem,
  useTrashList,
} from "@loom-web/src/hooks/content/useWorkflow";
import {
  useMediaList,
  useRestoreMedia,
} from "@loom-web/src/hooks/media/useMedia";
import { useCurrentUser } from "@loom-web/src/hooks/user/useCurrentUser";
import { formatDateTime, formatRelative } from "@loom-web/src/lib/format/date";
import { useContextStore } from "@loom-web/src/stores/context";
import { ArrowUUpLeft, ImageSquare, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

type TrashItem = Serialized<TrashItemResponseDto>;

function TrashRow({ item, canPurge }: { item: TrashItem; canPurge: boolean }) {
  const restore = useRestoreItem();
  const purge = usePurgeItem();
  const [isConfirming, setIsConfirming] = useState(false);
  const onError = { onError: (error: Error) => toast.danger(error.message) };

  return (
    <li className="flex flex-col gap-3 px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            className="truncate font-medium text-sm hover:text-accent"
            href={`/${CONTENT_TYPE_PATHS[item.type]}/${item.id}`}
          >
            {item.title}
          </Link>
          <span className="text-muted text-xs">
            {CONTENT_TYPE_LABELS[item.type]} · trashed{" "}
            <span title={formatDateTime(item.deletedAt)}>
              {formatRelative(item.deletedAt)}
            </span>
          </span>
        </div>
        <Button
          isDisabled={restore.isPending}
          onPress={() =>
            restore.mutate(
              { type: item.type, id: item.id },
              {
                ...onError,
                onSuccess: () => toast.success(`Restored ${item.title}`),
              },
            )
          }
          size="sm"
          variant="secondary"
        >
          <ArrowUUpLeft className="size-4" />
          Restore
        </Button>
        {canPurge && !isConfirming && (
          <Button
            className="text-muted"
            onPress={() => setIsConfirming(true)}
            size="sm"
            variant="ghost"
          >
            Delete forever
          </Button>
        )}
      </div>
      {isConfirming && (
        <Notice
          actions={
            <>
              <Button
                isDisabled={purge.isPending}
                onPress={() =>
                  purge.mutate({ type: item.type, id: item.id }, onError)
                }
                size="sm"
                variant="danger"
              >
                Delete forever
              </Button>
              <Button
                onPress={() => setIsConfirming(false)}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </>
          }
          title="Delete it for good?"
          tone="danger"
        >
          Every language and every version goes with it. This can't be undone.
        </Notice>
      )}
    </li>
  );
}

function DeletedImages({ canRestore }: { canRestore: boolean }) {
  const { data, isPending, error } = useMediaList({
    deleted: true,
    pageSize: 50,
  });
  const restore = useRestoreMedia();

  if (isPending) return <LoadingRows rows={2} />;
  if (error) return <ErrorText message={error.message} />;
  if (data.items.length === 0)
    return (
      <EmptyState icon={ImageSquare} title="No deleted images">
        Images deleted from the library show up here.
      </EmptyState>
    );

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
      {data.items.map((image) => (
        <div
          className="flex flex-col gap-2 rounded-lg border border-border p-2"
          key={image.id}
        >
          {/* biome-ignore lint/performance/noImgElement: media is served from the bucket, whose origin differs per environment */}
          <img
            alt={image.altText || image.filename}
            className="aspect-square w-full rounded-md bg-surface-secondary object-contain"
            src={image.url}
          />
          <span className="truncate text-xs">{image.filename}</span>
          {canRestore && (
            <Button
              isDisabled={restore.isPending}
              onPress={() =>
                restore.mutate(image.id, {
                  onError: (failure) => toast.danger(failure.message),
                })
              }
              size="sm"
              variant="secondary"
            >
              Restore
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Trashed content for the current Space, and deleted images, which are global. Kept forever until
 * someone chooses a permanent delete — an Admin or Author only.
 */
export function TrashList() {
  const spaceId = useContextStore((state) => state.spaceId);
  const { data: user } = useCurrentUser();
  const { data: items, isPending, error } = useTrashList(spaceId);
  const canPurge =
    user?.role === CmsRole.ADMIN || user?.role === CmsRole.AUTHOR;

  const content = () => {
    if (!spaceId || isPending) return <LoadingRows rows={3} />;
    if (error)
      return (
        <div className="px-5 py-4">
          <ErrorText message={error.message} />
        </div>
      );
    if (items.length === 0)
      return (
        <EmptyState icon={Trash} title="The Trash is empty">
          Anything moved to the Trash waits here, with every language, until it
          is restored or deleted for good.
        </EmptyState>
      );
    return (
      <ul className="divide-y divide-separator">
        {items.map((item) => (
          <TrashRow
            canPurge={canPurge}
            item={item}
            key={`${item.type}:${item.id}`}
          />
        ))}
      </ul>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Nothing here is on the website. Restore an item to bring back every language of it."
        title="Trash"
      />
      <Section
        bodyClassName="px-0 pt-3 pb-1"
        description="Every language of an item is trashed and restored together."
        title={`Content${items?.length ? ` · ${items.length}` : ""}`}
      >
        {content()}
      </Section>
      <Section
        description="Deleted images are hidden from the library and the pickers. Content already using one still shows it."
        title="Images"
      >
        <DeletedImages canRestore={canPurge} />
      </Section>
    </div>
  );
}
