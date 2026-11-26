import { SitesPanel } from "@loom-web/src/components/settings/SitesPanel";

export default function SitesSettingsPage() {
  return (
    <>
      <p className="max-w-[70ch] text-muted text-sm">
        The domain and refresh endpoint this site publishes to, and adding or
        removing sites.
      </p>
      <SitesPanel />
    </>
  );
}
