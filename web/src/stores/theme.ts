import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  type Theme,
} from "@loom-web/src/constants/theme";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** The viewer's own choice of theme — a per-browser preference, not a setting of the Site. */
interface ThemeState {
  theme: Theme;
}

interface ThemeActions {
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState & ThemeActions>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      setTheme: (theme) => set({ theme }),
    }),
    { name: THEME_STORAGE_KEY },
  ),
);
