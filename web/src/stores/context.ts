import type { Site, SiteLanguage, Space } from "@loom/dto/models";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Which Site, Space and language the CMS is currently working in. Every content screen reads this,
 * and it survives a reload so an editor does not re-pick it on every visit.
 */
interface ContextState {
  siteId: Site["id"] | null;
  spaceId: Space["id"] | null;
  languageCode: SiteLanguage["code"];
}

interface ContextActions {
  setSite: (siteId: Site["id"], spaceId: Space["id"]) => void;
  setSpace: (spaceId: Space["id"]) => void;
  setLanguage: (languageCode: SiteLanguage["code"]) => void;
}

export const useContextStore = create<ContextState & ContextActions>()(
  persist(
    (set) => ({
      siteId: null,
      spaceId: null,
      languageCode: "en",

      // Spaces belong to one Site, so switching Site always carries a Space with it
      setSite: (siteId, spaceId) => set({ siteId, spaceId }),
      setSpace: (spaceId) => set({ spaceId }),
      setLanguage: (languageCode) => set({ languageCode }),
    }),
    { name: "cms-context" },
  ),
);
