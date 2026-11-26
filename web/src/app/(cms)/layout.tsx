import { Sidebar } from "@loom-web/src/components/layout/Sidebar";
import { TopBar } from "@loom-web/src/components/layout/TopBar";
import type { ReactNode } from "react";

export default function CmsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1 px-8 pt-7 pb-16">{children}</main>
      </div>
    </div>
  );
}
