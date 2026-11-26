import { ApiKeysPanel } from "@loom-web/src/components/settings/ApiKeysPanel";

export default function ApiKeysSettingsPage() {
  return (
    <>
      <p className="max-w-[70ch] text-muted text-sm">
        Keys the website uses to read published content. Each has its own rate
        limit.
      </p>
      <ApiKeysPanel />
    </>
  );
}
