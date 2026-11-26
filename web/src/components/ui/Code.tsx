/** A value to be copied exactly: one click selects all of it. */
export function Code({ children }: { children: string }) {
  return (
    <code className="block select-all overflow-x-auto whitespace-pre rounded-md border border-border bg-surface px-3 py-2 font-mono text-foreground text-xs">
      {children}
    </code>
  );
}
