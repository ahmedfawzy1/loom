"use client";

import { Button, cn, Input, Modal, TextField } from "@heroui/react";
import type { RichTextEntryType } from "@loom/dto/constants";
import type { Author, Blog, Category, Cta, Tag } from "@loom/dto/models";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { LoadingRows } from "@loom-web/src/components/ui/LoadingRows";
import { Pill } from "@loom-web/src/components/ui/Pill";
import { useAuthors } from "@loom-web/src/hooks/content/useAuthors";
import { useBlogs } from "@loom-web/src/hooks/content/useBlogs";
import { useCategories } from "@loom-web/src/hooks/content/useCategories";
import { useCtas } from "@loom-web/src/hooks/content/useCtas";
import { useTags } from "@loom-web/src/hooks/content/useTags";
import { useDebounced } from "@loom-web/src/hooks/util/useDebounced";
import { useContextStore } from "@loom-web/src/stores/context";
import {
  Article,
  FolderSimple,
  type Icon,
  MagnifyingGlass,
  Megaphone,
  Tag as TagIcon,
  UserCircle,
} from "@phosphor-icons/react";
import { useState } from "react";

export type ReferenceKind = "cta" | RichTextEntryType;

/** The id of whatever was picked — any of the records a body can reference. */
export type ReferenceId =
  | Cta["id"]
  | Blog["id"]
  | Category["id"]
  | Tag["id"]
  | Author["id"];

const KIND_LABELS: Record<ReferenceKind, string> = {
  cta: "CTAs",
  blog: "Posts",
  category: "Categories",
  tag: "Tags",
  author: "Authors",
};

const KIND_ICONS: Record<ReferenceKind, Icon> = {
  cta: Megaphone,
  blog: Article,
  category: FolderSimple,
  tag: TagIcon,
  author: UserCircle,
};

interface ReferencePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which kinds are offered — a CTA embed offers only CTAs, an entry link offers the entry types. */
  kinds: readonly ReferenceKind[];
  onPick: (kind: ReferenceKind, id: ReferenceId) => void;
  /** Hidden from the list, so a post cannot be told to embed or link to itself. */
  excludeId?: string;
}

/**
 * Lists only the current Space's records. The API refuses a body that references anything outside
 * the post's own Space, so offering it here would only lead to a failed save.
 */
function useReferenceOptions(kind: ReferenceKind, q: string | undefined) {
  const spaceId = useContextStore((state) => state.spaceId);
  const language = useContextStore((state) => state.languageCode);
  const query = { spaceId: spaceId ?? "", language, q, pageSize: 50 };
  const enabled = (target: ReferenceKind) =>
    Boolean(spaceId) && kind === target;

  const lists = {
    cta: useCtas(query, enabled("cta")),
    blog: useBlogs(query, enabled("blog")),
    category: useCategories(query, enabled("category")),
    tag: useTags(query, enabled("tag")),
    author: useAuthors(query, enabled("author")),
  };
  return lists[kind];
}

export function ReferencePickerModal({
  isOpen,
  onClose,
  kinds,
  onPick,
  excludeId,
}: ReferencePickerModalProps) {
  const [kind, setKind] = useState<ReferenceKind>(kinds[0] ?? "cta");
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const { data, isPending, error } = useReferenceOptions(kind, q || undefined);

  const items = (data?.items ?? []).filter((item) => item.id !== excludeId);
  const KindIcon = KIND_ICONS[kind];

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container className="w-full" placement="center">
        <Modal.Dialog className="max-w-lg rounded-xl p-0">
          <Modal.CloseTrigger />
          <Modal.Header className="border-border border-b px-5 py-4">
            <Modal.Heading className="font-semibold text-base">
              {kinds.length === 1
                ? `Choose from ${KIND_LABELS[kind]}`
                : "Choose an entry"}
            </Modal.Heading>
            <p className="text-muted text-sm">
              Only entries in this Space are listed.
            </p>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-3 px-5 py-4">
            {kinds.length > 1 && (
              <div className="flex gap-1 self-start rounded-lg bg-surface-secondary p-0.5">
                {kinds.map((candidate) => (
                  <button
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium text-xs transition-colors duration-fast",
                      candidate === kind
                        ? "bg-accent-soft text-accent-soft-foreground"
                        : "text-muted hover:text-foreground",
                    )}
                    key={candidate}
                    onClick={() => setKind(candidate)}
                    type="button"
                  >
                    {KIND_LABELS[candidate]}
                  </button>
                ))}
              </div>
            )}

            <TextField
              aria-label="Search"
              className="relative"
              onChange={setSearch}
              value={search}
            >
              <MagnifyingGlass className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                className="h-8 ps-8 text-sm"
                placeholder="Search by title"
                type="search"
              />
            </TextField>

            {error && <ErrorText message={error.message} />}

            <div className="-mx-2 h-80 overflow-y-auto">
              {isPending && <LoadingRows rows={5} />}
              {data && items.length === 0 && (
                <EmptyState icon={MagnifyingGlass} title="Nothing matches">
                  Nothing in this Space fits that search.
                </EmptyState>
              )}
              <ul className="flex flex-col">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start text-sm transition-colors duration-fast hover:bg-accent-soft hover:text-accent-soft-foreground"
                      data-row
                      onClick={() => {
                        onPick(kind, item.id);
                        onClose();
                      }}
                      type="button"
                    >
                      <KindIcon className="size-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate">
                        {item.title}
                      </span>
                      {!item.hasRequestedLocale && (
                        <Pill dot={false}>Not translated</Pill>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Modal.Body>

          <Modal.Footer className="flex-row justify-end border-border border-t px-5 py-3">
            <Button onPress={onClose} variant="secondary">
              Cancel
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
