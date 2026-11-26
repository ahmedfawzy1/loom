"use client";

import { cn } from "@heroui/react";
import { isSafeHref, RICH_TEXT_ENTRY_TYPES } from "@loom/dto/constants";
import type { Media } from "@loom/dto/models";
import {
  type ReferenceId,
  type ReferenceKind,
  ReferencePickerModal,
} from "@loom-web/src/components/editor/ReferencePickerModal";
import { MediaLibraryModal } from "@loom-web/src/components/media/MediaLibraryModal";
import { EDITOR_EXTENSIONS } from "@loom-web/src/lib/editor/extensions";
import {
  At,
  Cards,
  Code,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  ListBullets,
  ListNumbers,
  Megaphone,
  Minus,
  Paperclip,
  Quotes,
  Table,
  TextB,
  TextItalic,
  TextStrikethrough,
  TextSubscript,
  TextSuperscript,
  TextUnderline,
} from "@phosphor-icons/react";
import {
  type Editor,
  EditorContent,
  type JSONContent,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

/** What an open picker will insert once something is chosen. */
type PendingInsert =
  | { kind: "ctaEmbed" }
  | { kind: "entryEmbed" }
  | { kind: "entryInline" }
  | { kind: "entryLink" }
  | { kind: "mediaEmbed" }
  | { kind: "assetLink" };

function ToolButton({
  label,
  isActive,
  isDisabled,
  onPress,
  children,
}: {
  label: string;
  isActive?: boolean;
  isDisabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={isActive}
      className={cn(
        "flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-sm transition-colors duration-fast",
        isActive
          ? "bg-accent-soft text-accent-soft-foreground"
          : "text-muted hover:bg-surface-tertiary hover:text-foreground",
        isDisabled && "pointer-events-none opacity-40",
      )}
      disabled={isDisabled}
      onClick={onPress}
      // Keeps the text selection alive — a mousedown on the button would otherwise blur the editor
      onMouseDown={(event) => event.preventDefault()}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-border" />;
}

/** Inline, so adding a link does not open a modal over the text being linked. */
function LinkBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [href, setHref] = useState(
    (editor.getAttributes("link").href as string | undefined) ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // The bar only opens because the editor asked for a link, so the field should be ready to type in
  useEffect(() => {
    input.current?.focus();
  }, []);

  const apply = () => {
    const value = href.trim();
    if (!value) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }

    // "example.com" means the website, not a relative path — say so rather than refuse it
    const target = /^[/#]|^[a-z][a-z0-9+.-]*:/i.test(value)
      ? value
      : `https://${value}`;
    // The same rule the API applies on save, checked here so the refusal is immediate and explained
    if (!isSafeHref(target)) {
      setError("Use an https:// or mailto: link, or a /path on this site");
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: target })
      .run();
    onClose();
  };

  return (
    <div className="flex items-center gap-2 border-border border-b bg-surface px-3 py-1.5">
      <input
        className="flex-1 bg-transparent text-sm outline-none"
        onChange={(event) => {
          setHref(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") apply();
          if (event.key === "Escape") onClose();
        }}
        placeholder="https://… — leave empty to remove the link"
        ref={input}
        value={href}
      />
      {error && (
        <span className="text-danger-soft-foreground text-xs">{error}</span>
      )}
      <button className="text-accent text-xs" onClick={apply} type="button">
        Apply
      </button>
      <button className="text-muted text-xs" onClick={onClose} type="button">
        Cancel
      </button>
    </div>
  );
}

function Toolbar({
  editor,
  onInsert,
  onLink,
}: {
  editor: Editor;
  onInsert: (pending: PendingInsert) => void;
  onLink: () => void;
}) {
  // Subscribes only to what the toolbar shows, rather than re-rendering on every transaction
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
      superscript: current.isActive("superscript"),
      subscript: current.isActive("subscript"),
      heading: [1, 2, 3, 4, 5, 6].find((level) =>
        current.isActive("heading", { level }),
      ),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      blockquote: current.isActive("blockquote"),
      link: current.isActive("link"),
      entryLink: current.isActive("entryLink"),
      assetLink: current.isActive("assetLink"),
      inTable: current.isActive("table"),
      hasSelection: !current.state.selection.empty,
    }),
  });

  const chain = () => editor.chain().focus();

  return (
    <div className="sticky top-[7.75rem] z-10 flex flex-wrap items-center gap-0.5 rounded-t-lg border-border border-b bg-surface-secondary px-1.5 py-1">
      <select
        aria-label="Block type"
        className="h-7 rounded-md bg-transparent px-1 text-sm hover:bg-surface-tertiary"
        onChange={(event) => {
          const level = Number(event.target.value);
          if (level)
            chain()
              .setHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
              .run();
          else chain().setParagraph().run();
        }}
        value={state.heading ?? 0}
      >
        <option value={0}>Paragraph</option>
        {[1, 2, 3, 4, 5, 6].map((level) => (
          <option key={level} value={level}>
            Heading {level}
          </option>
        ))}
      </select>

      <Divider />
      <ToolButton
        isActive={state.bold}
        label="Bold"
        onPress={() => chain().toggleBold().run()}
      >
        <TextB className="size-4" weight="bold" />
      </ToolButton>
      <ToolButton
        isActive={state.italic}
        label="Italic"
        onPress={() => chain().toggleItalic().run()}
      >
        <TextItalic className="size-4" />
      </ToolButton>
      <ToolButton
        isActive={state.underline}
        label="Underline"
        onPress={() => chain().toggleUnderline().run()}
      >
        <TextUnderline className="size-4" />
      </ToolButton>
      <ToolButton
        isActive={state.strike}
        label="Strikethrough"
        onPress={() => chain().toggleStrike().run()}
      >
        <TextStrikethrough className="size-4" />
      </ToolButton>
      <ToolButton
        isActive={state.code}
        label="Inline code"
        onPress={() => chain().toggleCode().run()}
      >
        <Code className="size-4" />
      </ToolButton>
      <ToolButton
        isActive={state.superscript}
        label="Superscript"
        onPress={() => chain().toggleSuperscript().run()}
      >
        <TextSuperscript className="size-4" />
      </ToolButton>
      <ToolButton
        isActive={state.subscript}
        label="Subscript"
        onPress={() => chain().toggleSubscript().run()}
      >
        <TextSubscript className="size-4" />
      </ToolButton>

      <Divider />
      <ToolButton
        isActive={state.bulletList}
        label="Bulleted list"
        onPress={() => chain().toggleBulletList().run()}
      >
        <ListBullets className="size-4" />
      </ToolButton>
      <ToolButton
        isActive={state.orderedList}
        label="Numbered list"
        onPress={() => chain().toggleOrderedList().run()}
      >
        <ListNumbers className="size-4" />
      </ToolButton>
      <ToolButton
        isActive={state.blockquote}
        label="Quote"
        onPress={() => chain().toggleBlockquote().run()}
      >
        <Quotes className="size-4" />
      </ToolButton>
      <ToolButton
        label="Horizontal rule"
        onPress={() => chain().setHorizontalRule().run()}
      >
        <Minus className="size-4" />
      </ToolButton>

      <Divider />
      <ToolButton
        isActive={state.link}
        isDisabled={!state.hasSelection && !state.link}
        label="Link to a URL"
        onPress={onLink}
      >
        <LinkIcon className="size-4" />
      </ToolButton>
      <ToolButton
        isActive={state.entryLink}
        isDisabled={!state.hasSelection}
        label="Link to another entry"
        onPress={() => onInsert({ kind: "entryLink" })}
      >
        <FileText className="size-4" />
      </ToolButton>
      <ToolButton
        isActive={state.assetLink}
        isDisabled={!state.hasSelection}
        label="Link to an image"
        onPress={() => onInsert({ kind: "assetLink" })}
      >
        <Paperclip className="size-4" />
      </ToolButton>

      <Divider />
      <ToolButton
        label="Embed an image"
        onPress={() => onInsert({ kind: "mediaEmbed" })}
      >
        <ImageIcon className="size-4" />
      </ToolButton>
      <ToolButton
        label="Embed a CTA"
        onPress={() => onInsert({ kind: "ctaEmbed" })}
      >
        <Megaphone className="size-4" />
      </ToolButton>
      <ToolButton
        label="Embed an entry as a block"
        onPress={() => onInsert({ kind: "entryEmbed" })}
      >
        <Cards className="size-4" />
      </ToolButton>
      <ToolButton
        label="Insert an entry inline"
        onPress={() => onInsert({ kind: "entryInline" })}
      >
        <At className="size-4" />
      </ToolButton>

      <Divider />
      <ToolButton
        label="Insert table"
        onPress={() =>
          chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <Table className="size-4" />
      </ToolButton>
      {state.inTable && (
        <>
          <ToolButton
            label="Add row below"
            onPress={() => chain().addRowAfter().run()}
          >
            <span className="text-xs">+ Row</span>
          </ToolButton>
          <ToolButton
            label="Add column right"
            onPress={() => chain().addColumnAfter().run()}
          >
            <span className="text-xs">+ Column</span>
          </ToolButton>
          <ToolButton
            label="Delete row"
            onPress={() => chain().deleteRow().run()}
          >
            <span className="text-xs">− Row</span>
          </ToolButton>
          <ToolButton
            label="Delete column"
            onPress={() => chain().deleteColumn().run()}
          >
            <span className="text-xs">− Column</span>
          </ToolButton>
          <ToolButton
            label="Delete table"
            onPress={() => chain().deleteTable().run()}
          >
            <span className="text-xs">Delete table</span>
          </ToolButton>
        </>
      )}
    </div>
  );
}

/**
 * Uncontrolled: it takes a document once and reports edits. Remount it (a `key`) to load a different
 * one, which also starts a fresh undo history, so Ctrl+Z cannot undo the load itself.
 */
export function RichTextEditor({
  initialContent,
  onChange,
  currentEntryId,
  dir,
}: {
  initialContent: JSONContent;
  onChange: (value: JSONContent) => void;
  /** The post being edited, hidden from reference pickers so it cannot point at itself. */
  currentEntryId?: string;
  /** Right-to-left for Arabic; the editor has to flip with the language it is editing. */
  dir?: "ltr" | "rtl";
}) {
  const [pending, setPending] = useState<PendingInsert | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  const editor = useEditor({
    extensions: EDITOR_EXTENSIONS,
    content: initialContent,
    // Rendered on the client only — the server has no DOM for ProseMirror to measure
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class:
          "prose max-w-none min-h-96 px-5 py-4 outline-none [&_table]:w-full [&_td]:border [&_td]:border-border [&_th]:border [&_th]:border-border [&_td]:px-2 [&_th]:px-2",
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
  });

  if (!editor)
    return (
      <div className="min-h-96 rounded-lg border border-border bg-surface" />
    );

  const insertReference = (kind: ReferenceKind, id: ReferenceId) => {
    if (!pending) return;
    const chain = editor.chain().focus();

    if (pending.kind === "ctaEmbed")
      chain.insertContent({ type: "ctaEmbed", attrs: { ctaId: id } }).run();
    else if (pending.kind === "entryEmbed")
      chain
        .insertContent({
          type: "entryEmbed",
          attrs: { entryType: kind, entryId: id },
        })
        .run();
    else if (pending.kind === "entryInline")
      chain
        .insertContent({
          type: "entryInline",
          attrs: { entryType: kind, entryId: id },
        })
        .run();
    else if (pending.kind === "entryLink")
      chain.setMark("entryLink", { entryType: kind, entryId: id }).run();
  };

  const insertMedia = (mediaId: Media["id"]) => {
    if (!pending) return;
    const chain = editor.chain().focus();
    if (pending.kind === "mediaEmbed")
      chain.insertContent({ type: "mediaEmbed", attrs: { mediaId } }).run();
    else if (pending.kind === "assetLink")
      chain.setMark("assetLink", { mediaId }).run();
  };

  const isMediaPicker =
    pending?.kind === "mediaEmbed" || pending?.kind === "assetLink";
  const isReferencePicker = pending !== null && !isMediaPicker;

  return (
    <div className="rounded-lg border border-border bg-surface focus-within:border-accent/50">
      <Toolbar
        editor={editor}
        onInsert={setPending}
        onLink={() => setIsLinking(true)}
      />
      {isLinking && (
        <LinkBar editor={editor} onClose={() => setIsLinking(false)} />
      )}
      <EditorContent dir={dir} editor={editor} />

      <MediaLibraryModal
        isOpen={isMediaPicker}
        onClose={() => setPending(null)}
        onPick={(picked) => insertMedia(picked.id)}
      />
      <ReferencePickerModal
        excludeId={currentEntryId}
        isOpen={isReferencePicker}
        // A CTA embed can only hold a CTA; every other reference points at an entry
        key={pending?.kind}
        kinds={pending?.kind === "ctaEmbed" ? ["cta"] : RICH_TEXT_ENTRY_TYPES}
        onClose={() => setPending(null)}
        onPick={insertReference}
      />
    </div>
  );
}
