"use client";

import { Button, Checkbox, Modal, toast } from "@heroui/react";
import type {
  BulkResultResponseDto,
  ContentItemResponseDto,
  LocaleStateResponseDto,
} from "@loom/dto";
import {
  type CmsContentType,
  LocaleStatus,
  type SiteLanguage,
} from "@loom/dto/models";
import { useEditor } from "@loom-web/src/components/content/editor/EditorContext";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { StatusChip } from "@loom-web/src/components/ui/StatusChip";
import { useBulk } from "@loom-web/src/hooks/content/useWorkflow";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useState } from "react";

type LocaleState = Serialized<LocaleStateResponseDto>;
type Result = Serialized<BulkResultResponseDto>;

const codesOf = (results: Result[]) =>
  results.map((result) => result.languageCode).join(", ");

/** One toast for the run: what went live, and what did not and why. */
const report = (results: Result[]) => {
  const done = results.filter((result) => result.outcome === "done");
  const problems = results.filter((result) => result.outcome !== "done");
  const detail = problems
    .map((result) => `${result.languageCode}: ${result.message}`)
    .join(" · ");

  if (!done.length)
    toast.danger("Nothing was published", { description: detail });
  else if (problems.length)
    toast.warning(`Published in ${codesOf(done)}`, { description: detail });
  else toast.success(`Published in ${codesOf(done)}`);
};

/**
 * Several languages of one item published in one go — the bulk publish over a single item, so
 * each language passes the same checks as publishing it alone, the website is told once, and each
 * reports its own outcome. Only languages with something unpublished are offered.
 */
export function PublishLanguagesModal({
  type,
  itemId,
  locales,
  isOpen,
  onClose,
}: {
  type: CmsContentType;
  itemId: ContentItemResponseDto["id"];
  locales: LocaleState[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const { site } = useActiveSite();
  const { isDirty, saveAll } = useEditor();
  const bulk = useBulk();
  const [selected, setSelected] = useState<Set<SiteLanguage["code"]>>(
    new Set(),
  );

  if (!site) return null;

  const publishable = site.languages
    .filter((language) => language.enabled)
    .sort((a, b) => a.position - b.position)
    .flatMap((language) => {
      const locale = locales.find(
        (candidate) => candidate.languageCode === language.code,
      );
      return locale && locale.status !== LocaleStatus.PUBLISHED
        ? [{ language, locale }]
        : [];
    });
  const inReview = publishable.filter(
    ({ locale }) =>
      selected.has(locale.languageCode) &&
      locale.status === LocaleStatus.IN_REVIEW,
  );
  const allSelected =
    publishable.length > 0 &&
    publishable.every(({ locale }) => selected.has(locale.languageCode));

  const toggle = (code: SiteLanguage["code"]) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected(next);
  };

  const publish = async () => {
    // What goes live is what is saved, so the language on screen is saved first
    if (isDirty && !(await saveAll({ quiet: true }))) return;
    bulk.mutate(
      {
        type,
        args: { action: "publish", ids: [itemId], languages: [...selected] },
      },
      {
        onSuccess: (results) => {
          report(results);
          setSelected(new Set());
          onClose();
        },
        onError: (error) => toast.danger(error.message),
      },
    );
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container className="w-full" placement="center">
        <Modal.Dialog className="max-w-md rounded-xl p-0">
          <Modal.CloseTrigger />
          <Modal.Header className="border-border border-b px-5 py-4">
            <Modal.Heading className="font-semibold text-base">
              Publish languages
            </Modal.Heading>
            <p className="text-muted text-sm">
              Each goes live as last saved. Languages already live and up to
              date aren't listed.
            </p>
          </Modal.Header>

          <Modal.Body className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto px-5 py-3">
            {publishable.length === 0 ? (
              <p className="py-6 text-center text-muted text-sm">
                Every language with a version is already live.
              </p>
            ) : (
              <>
                <Checkbox
                  isIndeterminate={selected.size > 0 && !allSelected}
                  isSelected={allSelected}
                  onChange={() =>
                    setSelected(
                      allSelected
                        ? new Set()
                        : new Set(
                            publishable.map(
                              ({ locale }) => locale.languageCode,
                            ),
                          ),
                    )
                  }
                >
                  <Checkbox.Content className="flex-row items-center gap-3">
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="font-medium text-sm">
                      All {publishable.length}
                    </span>
                  </Checkbox.Content>
                </Checkbox>
                <ul className="flex flex-col border-border border-t">
                  {publishable.map(({ language, locale }) => (
                    <li
                      className="flex min-h-10 items-center gap-3 border-separator border-b py-1.5 last:border-b-0"
                      key={language.code}
                    >
                      <Checkbox
                        isSelected={selected.has(language.code)}
                        onChange={() => toggle(language.code)}
                      >
                        <Checkbox.Content className="flex-row items-center gap-3">
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <span className="w-40 truncate text-sm">
                            {language.nativeName}
                            <span className="ms-1.5 font-mono text-muted text-xs">
                              {language.code}
                            </span>
                          </span>
                        </Checkbox.Content>
                      </Checkbox>
                      <StatusChip status={locale.status} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            {inReview.length > 0 && (
              <Notice tone="warning">
                {inReview.map(({ locale }) => locale.languageCode).join(", ")}{" "}
                {inReview.length === 1 ? "is" : "are"} waiting for review.
                Publishing approves {inReview.length === 1 ? "it" : "them"}.
              </Notice>
            )}
          </Modal.Body>

          <Modal.Footer className="flex justify-end gap-2 border-border border-t px-5 py-4">
            <Button onPress={onClose} variant="ghost">
              Cancel
            </Button>
            <Button
              isDisabled={selected.size === 0 || bulk.isPending}
              onPress={publish}
            >
              {bulk.isPending
                ? "Publishing…"
                : selected.size
                  ? `Publish ${selected.size}`
                  : "Publish selected"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
