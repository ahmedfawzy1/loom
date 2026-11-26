"use client";

import { Button, cn, Dropdown, Label } from "@heroui/react";
import type {
  BulkResultResponseDto,
  ContentListItemResponseDto,
} from "@loom/dto";
import { type BulkAction, CONTENT_TYPE_LABELS } from "@loom/dto/constants";
import { CmsContentType, CmsRole, type SiteLanguage } from "@loom/dto/models";
import { REFERENCED_TYPES } from "@loom-web/src/components/content/LiveUsageWarning";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { Segmented } from "@loom-web/src/components/ui/Segmented";
import { useBulkTranslate } from "@loom-web/src/hooks/content/useTranslation";
import { useBulk } from "@loom-web/src/hooks/content/useWorkflow";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useCurrentUser } from "@loom-web/src/hooks/user/useCurrentUser";
import { CaretDown, Translate, Trash, X } from "@phosphor-icons/react";
import { useState } from "react";

type Row = Serialized<ContentListItemResponseDto>;
type Result = Pick<
  Serialized<BulkResultResponseDto>,
  "id" | "title" | "languageCode" | "outcome" | "message"
>;

// Past this many, the problems are counted rather than listed
const LISTED_PROBLEMS = 20;

const PAST: Record<BulkAction | "translate", string> = {
  publish: "Published",
  unpublish: "Unpublished",
  submit: "Submitted",
  trash: "Moved to the Trash",
  restore: "Restored",
  translate: "Translated",
};

function Results({
  action,
  results,
  onDismiss,
}: {
  action: string;
  results: Result[];
  onDismiss: () => void;
}) {
  const count = (outcome: Result["outcome"]) =>
    results.filter((result) => result.outcome === outcome).length;
  const problems = results.filter((result) => result.outcome !== "done");

  return (
    <Notice
      actions={
        <Button onPress={onDismiss} size="sm" variant="secondary">
          Dismiss
        </Button>
      }
      title={
        <>
          {action}: {count("done")}
          {count("skipped") > 0 && `, skipped ${count("skipped")}`}
          {count("failed") > 0 && `, failed ${count("failed")}`}
        </>
      }
      tone={count("failed") > 0 ? "warning" : "info"}
    >
      {problems.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {problems.slice(0, LISTED_PROBLEMS).map((result) => (
            <li
              className={cn(
                result.outcome === "failed" && "text-danger-soft-foreground",
              )}
              key={`${result.id}:${result.languageCode}`}
            >
              {result.title}
              {result.languageCode && (
                <span className="font-mono"> ({result.languageCode})</span>
              )}
              : {result.message}
            </li>
          ))}
          {problems.length > LISTED_PROBLEMS && (
            <li>and {problems.length - LISTED_PROBLEMS} more</li>
          )}
        </ul>
      )}
    </Notice>
  );
}

/**
 * What can be done to the selected rows at once: publish and unpublish for those who may
 * publish, submit for Writers, the Trash and translation for everyone. Each item goes through the
 * same checks it would alone, and reports its own outcome. The bar floats over the list's foot so
 * it stays in reach however far down the selection goes.
 */
export function ContentBulkBar({
  type,
  rows,
  language,
  onDone,
}: {
  type: CmsContentType;
  rows: Row[];
  language: SiteLanguage["code"];
  onDone: () => void;
}) {
  const { data: user } = useCurrentUser();
  const { site } = useActiveSite();
  const bulk = useBulk();
  const bulkTranslate = useBulkTranslate();
  const [everyLanguage, setEveryLanguage] = useState(false);
  const [isConfirmingTrash, setIsConfirmingTrash] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<{
    action: string;
    results: Result[];
  }>();

  const canPublish =
    user?.role === CmsRole.ADMIN || user?.role === CmsRole.AUTHOR;
  const isWriter = user?.role === CmsRole.WRITER;
  const enabled = (site?.languages ?? [])
    .filter((candidate) => candidate.enabled)
    .map((candidate) => candidate.code);
  const languages = everyLanguage ? enabled : [language];
  const ids = rows.map((row) => row.id);
  const titleOf = (id: string) =>
    rows.find((row) => row.id === id)?.title ?? id;
  const isBusy = bulk.isPending || bulkTranslate.isPending;
  const noun = `${CONTENT_TYPE_LABELS[type].toLowerCase()}${rows.length === 1 ? "" : "s"}`;

  const run = (action: BulkAction) =>
    bulk.mutate(
      {
        type,
        args: {
          action,
          ids,
          ...(action === "trash" || action === "restore" ? {} : { languages }),
        },
      },
      {
        onSuccess: (results) => {
          setOutcome({ action: PAST[action], results });
          setIsConfirmingTrash(false);
          onDone();
        },
      },
    );

  const translate = (args: {
    languages?: string[];
    missing?: boolean;
    stale?: boolean;
  }) => {
    setProgress(0);
    bulkTranslate.mutate(
      { type, ids, args, onProgress: setProgress },
      {
        onSuccess: (items) => {
          setOutcome({
            action: PAST.translate,
            results: items.flatMap((item): Result[] =>
              item.error
                ? [
                    {
                      id: item.id,
                      title: titleOf(item.id),
                      languageCode: null,
                      outcome: "failed",
                      message: item.error,
                    },
                  ]
                : item.results.map((result) => ({
                    id: item.id,
                    title: titleOf(item.id),
                    languageCode: result.languageCode,
                    outcome:
                      result.outcome === "translated"
                        ? "done"
                        : result.outcome === "unchanged"
                          ? "skipped"
                          : "failed",
                    message:
                      result.message ??
                      (result.outcome === "unchanged"
                        ? "Already up to date"
                        : null),
                  })),
            ),
          });
          onDone();
        },
      },
    );
  };

  return (
    <>
      {outcome && !isBusy && (
        <Results
          action={outcome.action}
          onDismiss={() => setOutcome(undefined)}
          results={outcome.results}
        />
      )}
      {bulk.error && (
        <Notice tone="danger" title="The bulk action did not run">
          {bulk.error.message}
        </Notice>
      )}

      {(rows.length > 0 || isBusy) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center ps-60">
          <div className="pointer-events-auto flex max-w-[calc(100vw-18rem)] flex-wrap items-center gap-2 rounded-xl border border-border bg-overlay px-3 py-2 shadow-overlay">
            {isConfirmingTrash ? (
              <>
                <span className="px-1 text-sm">
                  Move {rows.length} {noun} to the Trash, every language
                  {REFERENCED_TYPES.includes(type) &&
                    "; live posts that use them lose them"}
                  {type === CmsContentType.BLOG && "; live pages go down"}?
                </span>
                <Button
                  isDisabled={isBusy}
                  onPress={() => run("trash")}
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
            ) : bulkTranslate.isPending ? (
              <span className="px-1 text-sm">
                Translating {progress} of {ids.length}…
              </span>
            ) : (
              <>
                <span className="px-1 font-medium text-sm tabular-nums">
                  {rows.length} selected
                </span>
                <span className="h-5 w-px bg-border" />

                {(canPublish || isWriter) && (
                  <Segmented
                    label="Which languages to act on"
                    onChange={(scope) => setEveryLanguage(scope === "every")}
                    options={[
                      {
                        id: "current",
                        label: (
                          <>
                            In <span className="font-mono">{language}</span>
                          </>
                        ),
                      },
                      { id: "every", label: "Every language" },
                    ]}
                    value={everyLanguage ? "every" : "current"}
                  />
                )}
                {canPublish && (
                  <>
                    <Button
                      isDisabled={isBusy}
                      onPress={() => run("publish")}
                      size="sm"
                    >
                      Publish
                    </Button>
                    <Button
                      isDisabled={isBusy}
                      onPress={() => run("unpublish")}
                      size="sm"
                      variant="secondary"
                    >
                      Unpublish
                    </Button>
                  </>
                )}
                {isWriter && (
                  <Button
                    isDisabled={isBusy}
                    onPress={() => run("submit")}
                    size="sm"
                  >
                    Submit for review
                  </Button>
                )}

                <Dropdown>
                  <Button isDisabled={isBusy} size="sm" variant="secondary">
                    <Translate className="size-4" />
                    Translate
                    <CaretDown className="size-3" />
                  </Button>
                  <Dropdown.Popover placement="top">
                    <Dropdown.Menu
                      aria-label="Translate the selection"
                      onAction={(key) => {
                        if (key === "missing") translate({ missing: true });
                        else if (key === "stale") translate({ stale: true });
                        else translate({ languages: [language] });
                      }}
                    >
                      {language !== site?.defaultLanguage ? (
                        <Dropdown.Item id="current" textValue="Into current">
                          <Label>
                            Into <span className="font-mono">{language}</span>
                          </Label>
                        </Dropdown.Item>
                      ) : null}
                      <Dropdown.Item id="missing" textValue="Missing languages">
                        <Label>Into every missing language</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="stale" textValue="Stale languages">
                        <Label>Update every stale language</Label>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>

                <Button
                  aria-label="Move to Trash"
                  isDisabled={isBusy}
                  isIconOnly
                  onPress={() => setIsConfirmingTrash(true)}
                  size="sm"
                  variant="ghost"
                >
                  <Trash className="size-4" />
                </Button>
                <Button
                  aria-label="Clear selection"
                  isIconOnly
                  onPress={onDone}
                  size="sm"
                  variant="ghost"
                >
                  <X className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
