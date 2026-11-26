export const THEMES = ["dark", "light", "system"] as const;
export type Theme = (typeof THEMES)[number];

// Each theme's --background as hex, for the browser's own bar around the page
export const THEME_COLORS = { dark: "#0E1116", light: "#F7F8FA" } as const;

export const DEFAULT_THEME: Theme = "light";

// Where the theme store persists, read before first paint by THEME_SCRIPT too
export const THEME_STORAGE_KEY = "cms-theme";

// Runs in <head> before the page paints, so a light-theme viewer never sees a flash of dark
export const THEME_SCRIPT = `try{var t=(JSON.parse(localStorage.getItem("${THEME_STORAGE_KEY}")||"{}").state||{}).theme||"${DEFAULT_THEME}";if(t==="system")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){}`;
