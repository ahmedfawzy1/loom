import { AppearancePanel } from "@loom-web/src/components/settings/AppearancePanel";

export default function AppearanceSettingsPage() {
  return (
    <>
      <p className="max-w-[70ch] text-muted text-sm">
        How Loom looks for you. This only changes this browser.
      </p>
      <AppearancePanel />
    </>
  );
}
