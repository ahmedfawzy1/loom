"use client";

import { Button, Input, Label, TextField, toast } from "@heroui/react";
import type { SiteResponseDto } from "@loom/dto";
import type { Site } from "@loom/dto/models";
import { SettingsPanel } from "@loom-web/src/components/settings/SettingsPanel";
import { Section } from "@loom-web/src/components/ui/Section";
import { useUpdateProtectedTerms } from "@loom-web/src/hooks/site/useSiteQueries";
import { Plus, X } from "@phosphor-icons/react";
import { useState } from "react";

/** Keyed on the Site, so switching Site reloads it and a refetch after saving does not. */
function ProtectedTermsForm({ site }: { site: Serialized<SiteResponseDto> }) {
  const updateTerms = useUpdateProtectedTerms();

  const [terms, setTerms] = useState<Site["protectedTerms"]>(
    site.protectedTerms,
  );
  const [draft, setDraft] = useState("");

  const addTerm = () => {
    const term = draft.trim();
    if (!term || terms.includes(term)) return;
    setTerms([...terms, term]);
    setDraft("");
  };

  return (
    <>
      <Section
        description={`${terms.length} term${terms.length === 1 ? "" : "s"}`}
        title="Terms"
      >
        {terms.length ? (
          <div className="flex flex-wrap gap-1.5">
            {terms.map((term) => (
              <span
                className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface-secondary ps-2.5 pe-1 text-sm"
                key={term}
              >
                {term}
                <button
                  aria-label={`Remove ${term}`}
                  className="flex size-5 items-center justify-center rounded text-muted transition-colors duration-fast hover:bg-danger-soft hover:text-danger-soft-foreground"
                  onClick={() =>
                    setTerms(terms.filter((candidate) => candidate !== term))
                  }
                  type="button"
                >
                  <X className="size-3" weight="bold" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-muted text-sm">No protected terms yet.</p>
        )}

        <div className="flex items-end gap-2">
          <TextField
            className="flex flex-1 flex-col gap-1.5"
            onChange={setDraft}
            value={draft}
          >
            <Label className="font-medium text-[13px]">Add a term</Label>
            <Input
              onKeyDown={(event) => {
                if (event.key === "Enter") addTerm();
              }}
              placeholder="Acme"
            />
          </TextField>
          <Button
            isDisabled={!draft.trim()}
            onPress={addTerm}
            variant="secondary"
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button
          isDisabled={updateTerms.isPending}
          onPress={() =>
            updateTerms.mutate(
              { siteId: site.id, protectedTerms: terms },
              {
                onSuccess: () => toast.success("Protected terms saved"),
                onError: (error) => toast.danger(error.message),
              },
            )
          }
        >
          {updateTerms.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </>
  );
}

export function ProtectedTermsPanel() {
  return (
    <SettingsPanel>
      {(site) => <ProtectedTermsForm key={site.id} site={site} />}
    </SettingsPanel>
  );
}
