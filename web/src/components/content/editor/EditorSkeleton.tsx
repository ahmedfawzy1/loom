import { Skeleton } from "@heroui/react";

export function EditorSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-md" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-5 w-72 rounded" />
        </div>
        <Skeleton className="ms-auto h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_20rem] gap-6">
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6">
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
