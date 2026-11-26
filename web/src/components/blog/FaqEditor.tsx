"use client";

import { Button } from "@heroui/react";
import type { FaqItemDto } from "@loom/dto";
import {
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_QUESTION_MAX_LENGTH,
} from "@loom/dto/constants";
import { FormField } from "@loom-web/src/components/content/FormField";
import { SortableList } from "@loom-web/src/components/ui/SortableList";
import { Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";

/**
 * An ordered list of question/answer pairs, with no maximum. Order matters because the website
 * renders it as-is, so moving an item is a first-class edit.
 */
export function FaqEditor({
  items,
  onChange,
  dir,
}: {
  items: FaqItemDto[];
  onChange: (items: FaqItemDto[]) => void;
  dir?: "ltr" | "rtl";
}) {
  // FAQ items carry no identity of their own; these give each row one for as long as it is on screen
  const [ids, setIds] = useState(() => items.map(() => crypto.randomUUID()));

  const itemOf = (id: string) => items[ids.indexOf(id)];

  const update = (id: string, patch: Partial<FaqItemDto>) =>
    onChange(
      items.map((item, at) => (ids[at] === id ? { ...item, ...patch } : item)),
    );

  const remove = (id: string) => {
    onChange(items.filter((_, at) => ids[at] !== id));
    setIds(ids.filter((candidate) => candidate !== id));
  };

  return (
    <div className="flex flex-col gap-3">
      <SortableList
        className="flex flex-col gap-3"
        ids={ids}
        labelOf={(id, index) =>
          `question ${index + 1}${itemOf(id)?.question ? `, ${itemOf(id)?.question}` : ""}`
        }
        onReorder={(next) => {
          onChange(next.map((id) => items[ids.indexOf(id)] as FaqItemDto));
          setIds(next);
        }}
        rowClassName="rounded-lg border border-border"
      >
        {(id, index, handle) => {
          const item = itemOf(id);
          if (!item) return null;
          return (
            <div className="flex gap-3 p-4 ps-2">
              <div className="flex shrink-0 flex-col items-center gap-1">
                {handle}
                <span className="font-medium text-muted text-xs tabular-nums">
                  {index + 1}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <FormField
                  dir={dir}
                  label="Question"
                  maxLength={FAQ_QUESTION_MAX_LENGTH}
                  onChange={(question) => update(id, { question })}
                  value={item.question}
                />
                <FormField
                  dir={dir}
                  label="Answer"
                  maxLength={FAQ_ANSWER_MAX_LENGTH}
                  multiline
                  onChange={(answer) => update(id, { answer })}
                  value={item.answer}
                />
              </div>
              <Button
                aria-label={`Remove question ${index + 1}`}
                isIconOnly
                onPress={() => remove(id)}
                size="sm"
                variant="ghost"
              >
                <Trash className="size-4" />
              </Button>
            </div>
          );
        }}
      </SortableList>

      <Button
        className="w-fit"
        onPress={() => {
          onChange([...items, { question: "", answer: "" }]);
          setIds([...ids, crypto.randomUUID()]);
        }}
        size="sm"
        variant="secondary"
      >
        <Plus className="size-4" />
        Add question
      </Button>
    </div>
  );
}
