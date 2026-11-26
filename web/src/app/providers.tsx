"use client";

import { Toast } from "@heroui/react";
import { ThemeSync } from "@loom-web/src/components/layout/ThemeSync";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  });

let browserQueryClient: QueryClient | undefined;

// The server builds a throwaway per request; the browser reuses one across remounts
const getQueryClient = () => {
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
};

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={getQueryClient()}>
        {children}
        <Toast.Provider placement="bottom end" />
        <ThemeSync />
      </QueryClientProvider>
    </MotionConfig>
  );
}
