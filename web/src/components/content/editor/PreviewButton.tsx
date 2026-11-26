"use client";

import { Button, toast } from "@heroui/react";
import type { LocaleStateResponseDto } from "@loom/dto";
import { CONTENT_TYPE_PATHS, isPreviewable } from "@loom/dto/constants";
import { useEditor } from "@loom-web/src/components/content/editor/EditorContext";
import type { LocaleRef } from "@loom-web/src/lib/api/workflow";
import { Eye } from "@phosphor-icons/react";
import { useState } from "react";

/**
 * Opens this language in Loom's preview page, in a new tab beside the editor. The preview shows
 * what is saved, so unsaved edits are saved first — and then the tab, opened at the click so the
 * browser allows it, is pointed at the page once the save is through.
 */
export function PreviewButton({
  localeRef,
  locale,
}: {
  localeRef: LocaleRef;
  /** This language's state; undefined until it is first saved, when there is nothing to show. */
  locale: Serialized<LocaleStateResponseDto> | undefined;
}) {
  const { isDirty, isSaving, saveAll } = useEditor();
  const [isSavingFirst, setIsSavingFirst] = useState(false);

  if (!isPreviewable(localeRef.type)) return null;

  const href = `/preview/${CONTENT_TYPE_PATHS[localeRef.type]}/${localeRef.id}?language=${localeRef.language}`;

  const open = async () => {
    if (!isDirty) {
      window.open(href, "_blank");
      return;
    }
    const tab = window.open("", "_blank");
    setIsSavingFirst(true);
    try {
      if (!(await saveAll({ quiet: true }))) {
        tab?.close();
        return;
      }
      if (tab) tab.location.href = href;
      else window.open(href, "_blank");
    } catch (error) {
      tab?.close();
      toast.danger(
        error instanceof Error ? error.message : "Failed to open the preview",
      );
    } finally {
      setIsSavingFirst(false);
    }
  };

  return (
    <Button
      isDisabled={(!locale && !isDirty) || isSaving || isSavingFirst}
      onPress={open}
      variant="ghost"
    >
      <Eye className="size-4" />
      {isSavingFirst ? "Saving…" : "Preview"}
    </Button>
  );
}
