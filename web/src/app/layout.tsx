import { cn } from "@heroui/react";
import "@loom-web/src/app/globals.css";
import {
  DEFAULT_THEME,
  THEME_COLORS,
  THEME_SCRIPT,
} from "@loom-web/src/constants/theme";
import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import type { ReactNode } from "react";
import Providers from "./providers";

const rubik = Rubik({
  subsets: ["latin"],
  variable: "--font-rubik",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Loom",
  description: "Loom — content management for every site",
  applicationName: "Loom",
  robots: { index: false, follow: false },
};

// The browser chrome takes each theme's --background, so it runs into the page without a seam
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      className={cn(rubik.variable, "font-sans", "antialiased")}
      data-theme={DEFAULT_THEME}
      // The admin chrome is English-only; the content it edits is not
      dir="ltr"
      lang="en"
      // THEME_SCRIPT changes data-theme before React hydrates, for anyone who chose otherwise
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string of ours, and it must run before first paint
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
