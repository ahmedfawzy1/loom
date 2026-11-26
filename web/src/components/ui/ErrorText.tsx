import { WarningCircle } from "@phosphor-icons/react/dist/ssr";

/** A request that failed, said where it failed. */
export function ErrorText({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 text-danger-soft-foreground text-sm">
      <WarningCircle className="size-4 shrink-0" />
      {message}
    </p>
  );
}
