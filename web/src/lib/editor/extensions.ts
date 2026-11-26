// The schema is built in @loom/dto, so the extensions' command types (toggleSubscript and
// the rest) are not augmented onto Tiptap here unless their declarations are referenced
/// <reference types="@tiptap/extension-subscript" />
/// <reference types="@tiptap/extension-superscript" />
/// <reference types="@tiptap/extension-table" />
/// <reference types="@tiptap/starter-kit" />
import {
  BASE_EXTENSIONS,
  CtaEmbed,
  EntryEmbed,
  EntryInline,
  MediaEmbed,
} from "@loom/dto/rich-text";
import {
  CtaEmbedView,
  EntryEmbedView,
  EntryInlineView,
  MediaEmbedView,
} from "@loom-web/src/components/editor/EmbedViews";
import { ReactNodeViewRenderer } from "@tiptap/react";

/**
 * The editor: the shared document schema with a React view attached to each reference node, so an
 * embed shows what it points at. A view changes how a node looks while editing, never what it
 * serialises to, so the editor still writes exactly the documents the API parses.
 */
export const EDITOR_EXTENSIONS = [
  ...BASE_EXTENSIONS,
  CtaEmbed.extend({ addNodeView: () => ReactNodeViewRenderer(CtaEmbedView) }),
  MediaEmbed.extend({
    addNodeView: () => ReactNodeViewRenderer(MediaEmbedView),
  }),
  EntryEmbed.extend({
    addNodeView: () => ReactNodeViewRenderer(EntryEmbedView),
  }),
  EntryInline.extend({
    addNodeView: () => ReactNodeViewRenderer(EntryInlineView),
  }),
];
