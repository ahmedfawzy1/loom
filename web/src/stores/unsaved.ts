import { create } from "zustand";

/**
 * Whether the open editor holds edits that are not saved yet. Switching language or Space remounts
 * the editor on other content, so whatever switches them asks first.
 */
interface UnsavedState {
  isDirty: boolean;
}

interface UnsavedActions {
  setDirty: (isDirty: boolean) => void;
}

export const useUnsavedStore = create<UnsavedState & UnsavedActions>()(
  (set) => ({
    isDirty: false,
    setDirty: (isDirty) => set({ isDirty }),
  }),
);

/** True when nothing unsaved would be lost, or the editor agrees to lose it. */
export const confirmDiscard = () =>
  !useUnsavedStore.getState().isDirty ||
  window.confirm("You have unsaved changes. Discard them?");
