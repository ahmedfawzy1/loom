"use client";

import { Button } from "@heroui/react";
import { RailSection } from "@loom-web/src/components/content/editor/EditorLayout";
import { useActiveSite } from "@loom-web/src/hooks/site/useActiveSite";
import { useContextStore } from "@loom-web/src/stores/context";
import { confirmDiscard } from "@loom-web/src/stores/unsaved";

/**
 * Stands in for the shared-fields form outside the default language. Those fields belong to every
 * language at once and are versioned with the default one, so editing them from another
 * language's view would record a change to that language that is not in it.
 */
export function SharedFieldsNotice({ fields }: { fields: string }) {
  const { site } = useActiveSite();
  const setLanguage = useContextStore((state) => state.setLanguage);
  const defaultLanguage = site?.defaultLanguage;

  return (
    <RailSection title="Shared by every language">
      <p className="text-muted text-sm">
        {fields} are the same in every language, so they are edited in the
        source language.
      </p>
      {defaultLanguage && (
        <Button
          className="w-fit"
          onPress={() => {
            if (confirmDiscard()) setLanguage(defaultLanguage);
          }}
          size="sm"
          variant="secondary"
        >
          Edit in <span className="font-mono">{defaultLanguage}</span>
        </Button>
      )}
    </RailSection>
  );
}
