"use client";

import { Button } from "@heroui/react";
import { Copy } from "@phosphor-icons/react";
import { useState } from "react";

/** Copies a secret shown once — a token, a password link — and says so. */
export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      onPress={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
      size="sm"
      variant="secondary"
    >
      <Copy className="size-4" />
      {copied ? "Copied" : label}
    </Button>
  );
}
