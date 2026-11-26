"use client";

import { cn, Input, Label, TextArea, TextField } from "@heroui/react";
import {
  SourceBadge,
  useFieldSync,
} from "@loom-web/src/components/content/editor/SourceSync";
import { useState } from "react";

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The API's name for a translated field, so a translation can mark it when its source moved on. */
  name?: string;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
  /** Shown as a running count beside the label. */
  maxLength?: number;
  isDisabled?: boolean;
  /** A document title: larger type, the field the page is about. */
  isTitle?: boolean;
  dir?: "ltr" | "rtl";
  mono?: boolean;
}

export function FormField({
  label,
  value,
  onChange,
  name,
  placeholder,
  hint,
  multiline,
  rows = 3,
  maxLength,
  isDisabled,
  isTitle,
  dir,
  mono,
}: FormFieldProps) {
  const sync = useFieldSync(name);
  const [showSource, setShowSource] = useState(false);
  const sourceText =
    typeof sync?.sourceValue === "string" ? sync.sourceValue : null;

  return (
    <TextField
      className="flex w-full flex-col gap-1.5"
      isDisabled={isDisabled}
      onChange={onChange}
      value={value}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Label className="font-medium text-[13px]">{label}</Label>
          {sync && (
            <>
              <SourceBadge
                sourceLanguage={sync.sourceLanguage}
                state={sync.state}
              />
              {sourceText !== null && (
                <button
                  className="text-accent text-xs hover:underline"
                  onClick={() => setShowSource(!showSource)}
                  type="button"
                >
                  {showSource ? "Hide" : "Show"} {sync.sourceLanguage}
                </button>
              )}
            </>
          )}
        </div>
        {maxLength !== undefined && (
          <span
            className={cn(
              "shrink-0 text-muted text-xs tabular-nums",
              value.length > maxLength && "text-danger-soft-foreground",
            )}
          >
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      {multiline ? (
        <TextArea
          className="text-sm leading-6"
          dir={dir}
          placeholder={placeholder}
          rows={rows}
        />
      ) : (
        <Input
          className={cn(
            isTitle && "h-11 font-semibold text-lg",
            mono && "font-mono text-[13px]",
          )}
          dir={dir}
          placeholder={placeholder}
        />
      )}
      {showSource && sync && sourceText !== null && (
        <div className="rounded-lg bg-surface-secondary px-3 py-2 text-sm">
          <p className="mb-1 font-medium text-muted text-xs">
            Now in {sync.sourceLanguage}
          </p>
          <p className="whitespace-pre-wrap" dir="auto">
            {sourceText || "(empty)"}
          </p>
        </div>
      )}
      {hint && <span className="text-muted text-xs">{hint}</span>}
    </TextField>
  );
}
