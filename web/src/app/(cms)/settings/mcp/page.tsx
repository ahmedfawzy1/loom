import { McpTokensPanel } from "@loom-web/src/components/settings/McpTokensPanel";

export default function McpSettingsPage() {
  return (
    <>
      <p className="max-w-[70ch] text-muted text-sm">
        Connect an AI assistant such as Claude to Loom. It works as you: it can
        read and edit what your role allows, and everything it saves is recorded
        as yours. It never publishes; that stays here.
      </p>
      <McpTokensPanel />
    </>
  );
}
