import { SpacesPanel } from "@loom-web/src/components/settings/SpacesPanel";

export default function SpacesSettingsPage() {
  return (
    <>
      <p className="max-w-[70ch] text-muted text-sm">
        Spaces hold a site's content. Create one empty or clone an existing one.
      </p>
      <SpacesPanel />
    </>
  );
}
