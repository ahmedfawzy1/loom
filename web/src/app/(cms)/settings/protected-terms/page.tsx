import { ProtectedTermsPanel } from "@loom-web/src/components/settings/ProtectedTermsPanel";

export default function ProtectedTermsSettingsPage() {
  return (
    <>
      <p className="max-w-[70ch] text-muted text-sm">
        Brand and product names DeepL leaves as written in every language.
      </p>
      <ProtectedTermsPanel />
    </>
  );
}
