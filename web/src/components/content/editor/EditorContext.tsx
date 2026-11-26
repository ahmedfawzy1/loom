"use client";

import { toast } from "@heroui/react";
import { confirmDiscard, useUnsavedStore } from "@loom-web/src/stores/unsaved";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface Section {
  /** What the section is called when it fails to save: "Post details", "English". */
  label: string;
  save: () => Promise<unknown>;
  /** The shared fields save first: they version with the default language. */
  order: number;
}

interface EditorContextValue {
  register: (id: string, section: Section) => void;
  unregister: (id: string) => void;
  setDirty: (id: string, isDirty: boolean) => void;
  isDirty: boolean;
  isSaving: boolean;
  /**
   * Saves every section with edits; true when all of them saved. `quiet` skips the success toast
   * when a step follows that reports for both — HeroUI animates each toast in a view transition,
   * and a second one straight after aborts the first's.
   */
  saveAll: (options?: { quiet?: boolean }) => Promise<boolean>;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export const useEditor = () => {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error("useEditor needs an EditorProvider above it");
  return editor;
};

/**
 * One Save for the whole editor. Each part of the form — the shared fields, one language's fields —
 * keeps its own state and saves through its own endpoint; they register here, and the header's
 * Save (or ⌘S) saves whichever of them hold edits.
 */
export function EditorProvider({ children }: { children: ReactNode }) {
  const sections = useRef(new Map<string, Section>());
  const [dirty, setDirtyIds] = useState<ReadonlySet<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const setUnsaved = useUnsavedStore((state) => state.setDirty);
  const isDirty = dirty.size > 0;

  const register = useCallback((id: string, section: Section) => {
    sections.current.set(id, section);
  }, []);

  const unregister = useCallback((id: string) => {
    sections.current.delete(id);
    setDirtyIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const setDirty = useCallback((id: string, next: boolean) => {
    setDirtyIds((current) => {
      if (current.has(id) === next) return current;
      const updated = new Set(current);
      if (next) updated.add(id);
      else updated.delete(id);
      return updated;
    });
  }, []);

  const saveAll = useCallback(
    async (options?: { quiet?: boolean }) => {
      const pending = [...dirty]
        .map((id) => sections.current.get(id))
        .filter((section): section is Section => Boolean(section))
        .sort((a, b) => a.order - b.order);
      if (!pending.length) return true;

      setIsSaving(true);
      const failures: string[] = [];
      // One at a time, shared first: the language save then builds on the version the shared save made
      for (const section of pending) {
        try {
          await section.save();
        } catch (error) {
          failures.push(
            `${section.label}: ${error instanceof Error ? error.message : "could not be saved"}`,
          );
        }
      }
      setIsSaving(false);

      if (failures.length) {
        toast.danger("Not everything saved", {
          description: failures.join(" · "),
        });
        return false;
      }
      if (!options?.quiet) toast.success("Saved");
      return true;
    },
    [dirty],
  );

  useEffect(() => {
    setUnsaved(isDirty);
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    // An in-app link unmounts the editor without unloading the page. Caught in the capture phase,
    // before React's root listener hands the click to next/link.
    const guardLinks = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest("a[href]");
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.origin !== window.location.origin ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.button !== 0 ||
        confirmDiscard()
      )
        return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLinks, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLinks, true);
    };
  }, [isDirty, setUnsaved]);

  useEffect(() => () => setUnsaved(false), [setUnsaved]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "s" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (!isSaving) saveAll();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSaving, saveAll]);

  const value = useMemo(
    () => ({ register, unregister, setDirty, isDirty, isSaving, saveAll }),
    [register, unregister, setDirty, isDirty, isSaving, saveAll],
  );

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

/**
 * Makes one part of the form savable from the header. `values` is everything the part edits; it is
 * dirty while they differ from what was last loaded or saved. The part is keyed by its parent on
 * what it edits, so a remount — another language, a restore — starts a fresh baseline.
 */
export function useEditorSection({
  id,
  label,
  order,
  values,
  save,
}: {
  id: string;
  label: string;
  order: number;
  values: unknown;
  save: () => Promise<unknown>;
}) {
  const { register, unregister, setDirty } = useEditor();
  const snapshot = JSON.stringify(values);
  const [baseline, setBaseline] = useState(snapshot);
  const isDirty = snapshot !== baseline;

  useEffect(() => {
    register(id, {
      label,
      order,
      save: async () => {
        await save();
        setBaseline(snapshot);
      },
    });
  }, [id, label, order, save, snapshot, register]);

  useEffect(() => () => unregister(id), [id, unregister]);

  useEffect(() => setDirty(id, isDirty), [id, isDirty, setDirty]);

  return { isDirty };
}
