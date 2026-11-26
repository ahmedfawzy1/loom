import { SettingsNav } from "@loom-web/src/components/settings/SettingsNav";
import { PageHeader } from "@loom-web/src/components/ui/PageHeader";
import type { ReactNode } from "react";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="How this site is set up, and how Loom looks for you."
        title="Settings"
      />
      <SettingsNav />
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </div>
  );
}
