"use client";

import { Button } from "@heroui/react";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import type { ApiError } from "@loom-web/src/lib/api";
import { CaretLeft } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Creating an item asks only for what it cannot exist without; everything else is written in the
 * editor it opens into.
 */
export function NewItemForm({
  title,
  subtitle,
  listHref,
  listLabel,
  isPending,
  isDisabled,
  error,
  onCreate,
  children,
}: {
  title: string;
  subtitle: string;
  listHref: string;
  listLabel: string;
  isPending: boolean;
  isDisabled?: boolean;
  error: ApiError | null;
  onCreate: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          className="flex w-fit items-center gap-1 text-muted text-sm hover:text-foreground"
          href={listHref}
        >
          <CaretLeft className="size-3.5" />
          {listLabel}
        </Link>
        <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
        <p className="text-muted text-sm">{subtitle}</p>
      </div>

      <form
        className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isDisabled && !isPending) onCreate();
        }}
      >
        {children}
        <div className="flex items-center justify-end gap-3 border-separator border-t pt-5">
          {error && <ErrorText message={error.message} />}
          <Link
            className="px-2 text-muted text-sm hover:text-foreground"
            href={listHref}
          >
            Cancel
          </Link>
          <Button isDisabled={isDisabled || isPending} type="submit">
            {isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}
