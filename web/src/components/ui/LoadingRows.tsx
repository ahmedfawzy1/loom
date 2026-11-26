import { Skeleton } from "@heroui/react";

const PLACEHOLDERS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** A list's shape while it loads: rows where rows will be, not a spinner in their place. */
export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy className="flex flex-col">
      {PLACEHOLDERS.slice(0, rows).map((key) => (
        <div
          className="flex items-center gap-4 border-separator border-b px-4 py-3.5 last:border-b-0"
          key={key}
        >
          <Skeleton className="h-3.5 w-2/5 rounded" />
          <Skeleton className="ms-auto h-3.5 w-20 rounded" />
          <Skeleton className="h-3.5 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}
