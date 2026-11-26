import { RefreshLivePagesPanel } from "@loom-web/src/components/settings/RefreshLivePagesPanel";

export default function RefreshLivePagesPage() {
  return (
    <>
      <p className="max-w-[70ch] text-muted text-sm">
        Publishing refreshes the pages it changes. This refreshes every page at
        once.
      </p>
      <RefreshLivePagesPanel />
    </>
  );
}
