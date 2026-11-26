"use client";

import { THEME_COLORS } from "@loom-web/src/constants/theme";
import { useThemeStore } from "@loom-web/src/stores/theme";
import { useEffect } from "react";

const LIGHT_QUERY = "(prefers-color-scheme: light)";

/** Puts the chosen theme on <html>, following the system's while "system" is chosen. */
export function ThemeSync() {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const media = window.matchMedia(LIGHT_QUERY);
    const apply = () => {
      const resolved =
        theme === "system" ? (media.matches ? "light" : "dark") : theme;
      document.documentElement.dataset.theme = resolved;
      // The viewport's theme-color follows the device; the viewer's choice overrides it
      for (const meta of document.querySelectorAll('meta[name="theme-color"]'))
        meta.setAttribute("content", THEME_COLORS[resolved]);
    };
    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  return null;
}
