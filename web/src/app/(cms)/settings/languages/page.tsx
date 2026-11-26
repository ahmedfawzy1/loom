import { LanguagesPanel } from "@loom-web/src/components/settings/LanguagesPanel";

export default function LanguagesSettingsPage() {
  return (
    <>
      <p className="max-w-[70ch] text-muted text-sm">
        Which languages this site publishes, and the DeepL code each translates
        into.
      </p>
      <LanguagesPanel />
    </>
  );
}
