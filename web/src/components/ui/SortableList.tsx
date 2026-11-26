"use client";

import { cn } from "@heroui/react";
import { DotsSixVertical } from "@phosphor-icons/react";
import { Reorder, useDragControls } from "motion/react";
import type { KeyboardEvent, ReactNode } from "react";

function SortableRow({
  id,
  label,
  index,
  count,
  onMove,
  className,
  children,
}: {
  id: string;
  label: string;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  className?: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const controls = useDragControls();

  // The handle is also the keyboard way to reorder, for anyone not using a pointer
  const onKeyDown = (event: KeyboardEvent) => {
    const delta = { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    const target = index + delta;
    if (target >= 0 && target < count) onMove(index, target);
  };

  const handle = (
    <button
      aria-label={`Move ${label}. Drag, or press the up and down arrows`}
      className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted transition-colors duration-fast hover:bg-surface-tertiary hover:text-foreground active:cursor-grabbing"
      onKeyDown={onKeyDown}
      onPointerDown={(event) => controls.start(event)}
      type="button"
    >
      <DotsSixVertical className="size-4" weight="bold" />
    </button>
  );

  return (
    <Reorder.Item
      className={cn("relative bg-surface", className)}
      dragControls={controls}
      dragListener={false}
      value={id}
      whileDrag={{
        boxShadow: "var(--overlay-shadow)",
        zIndex: 10,
      }}
    >
      {children(handle)}
    </Reorder.Item>
  );
}

/**
 * A list reordered by dragging a row's handle, or with the arrow keys on it. Works on ids: the
 * parent maps the new order of ids back onto whatever the rows hold.
 */
export function SortableList({
  ids,
  labelOf,
  onReorder,
  className,
  rowClassName,
  children,
}: {
  ids: string[];
  /** How the handle names each row to a screen reader. */
  labelOf: (id: string, index: number) => string;
  onReorder: (ids: string[]) => void;
  className?: string;
  rowClassName?: string;
  children: (id: string, index: number, handle: ReactNode) => ReactNode;
}) {
  const move = (from: number, to: number) => {
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    onReorder(next);
  };

  return (
    <Reorder.Group
      axis="y"
      className={className}
      onReorder={onReorder}
      values={ids}
    >
      {ids.map((id, index) => (
        <SortableRow
          className={rowClassName}
          count={ids.length}
          id={id}
          index={index}
          key={id}
          label={labelOf(id, index)}
          onMove={move}
        >
          {(handle) => children(id, index, handle)}
        </SortableRow>
      ))}
    </Reorder.Group>
  );
}
