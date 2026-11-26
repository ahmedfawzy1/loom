"use client";

import { Button, cn, Dropdown, Label, toast } from "@heroui/react";
import type { ContentItemResponseDto, LocaleStateResponseDto } from "@loom/dto";
import { CONTENT_TYPE_LABELS, CONTENT_TYPE_PATHS } from "@loom/dto/constants";
import type { CmsContentType } from "@loom/dto/models";
import { useEditor } from "@loom-web/src/components/content/editor/EditorContext";
import { LanguagePanel } from "@loom-web/src/components/content/editor/LanguagePanel";
import { PreviewButton } from "@loom-web/src/components/content/editor/PreviewButton";
import {
  type ContentLocale,
  SourceSyncProvider,
} from "@loom-web/src/components/content/editor/SourceSync";
import {
  PrimaryAction,
  StatusPanel,
} from "@loom-web/src/components/content/editor/WorkflowControls";
import {
  LiveUsageWarning,
  REFERENCED_TYPES,
} from "@loom-web/src/components/content/LiveUsageWarning";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { NAVIGATION } from "@loom-web/src/constants/navigation";
import {
  useDuplicate,
  useRestoreItem,
  useTrashItem,
} from "@loom-web/src/hooks/content/useWorkflow";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useContextStore } from "@loom-web/src/stores/context";
import { confirmDiscard } from "@loom-web/src/stores/unsaved";
import { CaretLeft, CopySimple, DotsThree, Trash } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

type LocaleState = Serialized<LocaleStateResponseDto>;

/** A titled group of the rail: a white sheet, stacked with the others. */
export function RailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-semibold text-muted text-xs">{title}</h2>
      {children}
    </section>
  );
}

export function SaveState() {
  const { isDirty, isSaving, saveAll } = useEditor();
  return (
    <>
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs",
          isDirty ? "text-warning-soft-foreground" : "text-muted",
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            isDirty ? "bg-warning" : "bg-success",
          )}
        />
        {isSaving ? "Saving…" : isDirty ? "Unsaved changes" : "All saved"}
      </span>
      <Button
        isDisabled={!isDirty || isSaving}
        onPress={() => saveAll()}
        variant="secondary"
      >
        Save
      </Button>
    </>
  );
}

/**
 * The editor for one item in the language worked in: a sticky header with the one Save
 * and the next workflow step, the language's own fields on the left, and on the right the rail —
 * where the language stands, every other language, and the fields all languages share.
 */
export function EditorLayout({
  type,
  itemId,
  deletedAt,
  title,
  locale,
  locales,
  onReload,
  main,
  shared,
}: {
  type: CmsContentType;
  itemId: ContentItemResponseDto["id"];
  deletedAt: string | null;
  title: string;
  /** This language's state; undefined until it is first saved. */
  locale: LocaleState | undefined;
  /** Whole locales, as the item response carries them — the source one feeds SourceSync. */
  locales: ContentLocale[];
  /** Restoring a version or translating replaces what the fields were seeded from. */
  onReload: () => void;
  main: ReactNode;
  /** The fields every language shares, or the notice that says where they are edited. */
  shared: ReactNode;
}) {
  const router = useRouter();
  const language = useContextStore((state) => state.languageCode);
  const { site } = useActiveSite();
  const duplicate = useDuplicate();
  const trash = useTrashItem();
  const restore = useRestoreItem();
  const [isConfirmingTrash, setIsConfirmingTrash] = useState(false);
  const basePath = `/${CONTENT_TYPE_PATHS[type]}`;
  const listLabel =
    NAVIGATION.flatMap((section) => section.items).find(
      (item) => item.href === basePath,
    )?.label ?? CONTENT_TYPE_LABELS[type];
  const noun = CONTENT_TYPE_LABELS[type].toLowerCase();
  const localeRef = { type, id: itemId, language };

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-13 z-20 -mx-8 -mt-7 flex items-center gap-4 border-border border-b bg-background px-8 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            aria-label={`Back to ${listLabel}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-fast hover:bg-surface-tertiary hover:text-foreground"
            href={basePath}
          >
            <CaretLeft className="size-4" />
          </Link>
          <div className="flex min-w-0 flex-col">
            <span className="text-muted text-xs">{listLabel}</span>
            <h1 className="truncate font-semibold text-lg leading-6">
              {title || `Untitled ${noun}`}
            </h1>
          </div>
        </div>

        {!deletedAt && (
          <div className="flex shrink-0 items-center gap-2">
            <SaveState />
            <PreviewButton locale={locale} localeRef={localeRef} />
            <PrimaryAction locale={locale} localeRef={localeRef} />
            <Dropdown>
              <Button aria-label="More actions" isIconOnly variant="ghost">
                <DotsThree className="size-5" weight="bold" />
              </Button>
              <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu
                  aria-label="Item actions"
                  onAction={(key) => {
                    if (key === "trash") setIsConfirmingTrash(true);
                    // The copy is made from what is saved, and opening it leaves this editor
                    if (key === "duplicate" && confirmDiscard())
                      duplicate.mutate(
                        { type, id: itemId },
                        {
                          onSuccess: (copy) =>
                            router.push(`${basePath}/${copy.id}`),
                          onError: (error) => toast.danger(error.message),
                        },
                      );
                  }}
                >
                  <Dropdown.Item id="duplicate" textValue="Duplicate">
                    <CopySimple className="size-4 text-muted" />
                    <Label>Duplicate</Label>
                  </Dropdown.Item>
                  <Dropdown.Item
                    id="trash"
                    textValue="Move to Trash"
                    variant="danger"
                  >
                    <Trash className="size-4" />
                    <Label>Move to Trash</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        )}
      </div>

      {deletedAt && (
        <Notice
          actions={
            <Button
              isDisabled={restore.isPending}
              onPress={() =>
                restore.mutate(
                  { type, id: itemId },
                  { onError: (error) => toast.danger(error.message) },
                )
              }
              size="sm"
            >
              Restore
            </Button>
          }
          title="In the Trash"
          tone="danger"
        >
          This {noun} is in the Trash with every language. Restore it to edit or
          publish it.
        </Notice>
      )}

      {isConfirmingTrash && (
        <Notice
          actions={
            <>
              <Button
                isDisabled={trash.isPending}
                onPress={() =>
                  trash.mutate(
                    { type, id: itemId },
                    {
                      onSuccess: () => setIsConfirmingTrash(false),
                      onError: (error) => toast.danger(error.message),
                    },
                  )
                }
                size="sm"
                variant="danger"
              >
                Move to Trash
              </Button>
              <Button
                onPress={() => setIsConfirmingTrash(false)}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </>
          }
          title={`Move this ${noun} to the Trash?`}
          tone="warning"
        >
          Every language goes together, and anything live comes off the website.
          {REFERENCED_TYPES.includes(type) && (
            <div className="mt-2">
              <LiveUsageWarning
                consequence="Moving it to the Trash"
                id={itemId}
                type={type}
              />
            </div>
          )}
        </Notice>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-6">
        <SourceSyncProvider
          itemId={itemId}
          language={language}
          source={locales.find(
            (candidate) => candidate.languageCode === site?.defaultLanguage,
          )}
          sourceLanguage={site?.defaultLanguage}
          type={type}
        >
          <div className="flex min-w-0 flex-col gap-6">{main}</div>
        </SourceSyncProvider>
        <aside className="sticky top-32 flex max-h-[calc(100vh-9rem)] flex-col gap-4 overflow-y-auto pb-2">
          <RailSection title={`Status in ${language}`}>
            <StatusPanel
              locale={locale}
              localeRef={localeRef}
              locales={locales}
              onRestored={onReload}
            />
          </RailSection>
          {!deletedAt && (
            <RailSection title="Languages">
              <LanguagePanel
                itemId={itemId}
                locales={locales}
                onTranslated={onReload}
                type={type}
              />
            </RailSection>
          )}
          {shared}
        </aside>
      </div>
    </div>
  );
}
