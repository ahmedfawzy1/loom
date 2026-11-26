/**
 * The post-body schema as Tiptap extensions with no React in them. The web editor is
 * built from these and the API parses every saved body with the schema they produce, so what the
 * editor can write and what the API accepts are the same definition rather than two lists.
 *
 * A separate subpath from the package root and from ./constants: it pulls in Tiptap and
 * ProseMirror, which neither the DTO classes nor the browser-safe constants should carry.
 */
import { getSchema, Mark, mergeAttributes, Node } from "@tiptap/core";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import {
  isSafeHref,
  RICH_TEXT_HEADING_LEVELS,
  RICH_TEXT_LINK_REL,
  type RICH_TEXT_REFERENCE_MARKS,
  type RICH_TEXT_REFERENCE_NODES,
} from "../constants/rich-text.constants";

// Typed against the reference maps, so renaming a node there fails this build instead of letting
// the collectors and the schema disagree about what a reference is called
type ReferenceNode = keyof typeof RICH_TEXT_REFERENCE_NODES;
type ReferenceMark = keyof typeof RICH_TEXT_REFERENCE_MARKS;

/** A block-level reference: selectable and draggable as a unit, never edited as text. */
const blockEmbed = (
  name: ReferenceNode,
  attributes: string[],
  dataAttribute: string,
) =>
  Node.create({
    name,
    group: "block",
    atom: true,
    draggable: true,
    selectable: true,
    addAttributes() {
      return Object.fromEntries(
        attributes.map((attr) => [attr, { default: null }]),
      );
    },
    parseHTML() {
      return [{ tag: `div[${dataAttribute}]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["div", mergeAttributes(HTMLAttributes, { [dataAttribute]: "" })];
    },
  });

export const CtaEmbed = blockEmbed("ctaEmbed", ["ctaId"], "data-cta-embed");

export const MediaEmbed = blockEmbed(
  "mediaEmbed",
  ["mediaId"],
  "data-media-embed",
);

export const EntryEmbed = blockEmbed(
  "entryEmbed",
  ["entryType", "entryId"],
  "data-entry-embed",
);

const ENTRY_INLINE: ReferenceNode = "entryInline";
const ENTRY_LINK: ReferenceMark = "entryLink";
const ASSET_LINK: ReferenceMark = "assetLink";

export const EntryInline = Node.create({
  name: ENTRY_INLINE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { entryType: { default: null }, entryId: { default: null } };
  },
  parseHTML() {
    return [{ tag: "span[data-entry-inline]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-entry-inline": "" }),
    ];
  },
});

/** A hyperlink to another entry, resolved to its URL by the website rather than stored as one. */
export const EntryLink = Mark.create({
  name: ENTRY_LINK,
  // Cannot overlap a URL link — a run of text points at one place
  excludes: "link assetLink",
  addAttributes() {
    return { entryType: { default: null }, entryId: { default: null } };
  },
  parseHTML() {
    return [{ tag: "a[data-entry-link]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { "data-entry-link": "" }), 0];
  },
});

/** A hyperlink to an image in the media library, by id so a Replace does not break it. */
export const AssetLink = Mark.create({
  name: ASSET_LINK,
  excludes: "link entryLink",
  addAttributes() {
    return { mediaId: { default: null } };
  },
  parseHTML() {
    return [{ tag: "a[data-asset-link]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { "data-asset-link": "" }), 0];
  },
});

/** Everything except the reference nodes, which the editor wraps with a view. */
export const BASE_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [...RICH_TEXT_HEADING_LEVELS] },
    codeBlock: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      // Declared outright rather than left to Tiptap's defaults, so the API can pin them exactly
      HTMLAttributes: { rel: RICH_TEXT_LINK_REL, target: null, class: null },
      // The same rule the API enforces, so a pasted javascript: link never becomes a mark at all
      isAllowedUri: (url) => isSafeHref(url),
    },
  }),
  Superscript,
  Subscript,
  TableKit.configure({ table: { resizable: false } }),
  EntryLink,
  AssetLink,
];

export const RICH_TEXT_EXTENSIONS = [
  ...BASE_EXTENSIONS,
  CtaEmbed,
  MediaEmbed,
  EntryEmbed,
  EntryInline,
];

export const RICH_TEXT_SCHEMA = getSchema(RICH_TEXT_EXTENSIONS);
