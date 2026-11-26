import type { Author, Blog, Category, Cta, Tag } from "@loom/database";
import {
  isSafeHref,
  RICH_TEXT_ENTRY_TYPES,
  RICH_TEXT_HEADING_LEVELS,
  RICH_TEXT_LINK_REL,
  RICH_TEXT_MAX_BYTES,
  RICH_TEXT_REFERENCE_MARKS,
  RICH_TEXT_REFERENCE_NODES,
  RICH_TEXT_TABLE_MAX_COLUMN_WIDTH,
  RICH_TEXT_TABLE_MAX_SPAN,
  type RichTextEntryType,
} from "@loom/dto/constants";
import { RICH_TEXT_SCHEMA } from "@loom/dto/rich-text";
import { BadRequestException } from "@nestjs/common";

/** A ProseMirror node as Tiptap serialises it. */
export interface RichTextNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

/** Every record a document points at, grouped by what kind of record it is. */
export interface RichTextReferences {
  ctaIds: Set<string>;
  mediaIds: Set<string>;
  entries: { type: RichTextEntryType; id: string }[];
}

/** A body parsed against the schema — what the attribute checks walk. */
type DocumentNode = ReturnType<typeof RICH_TEXT_SCHEMA.nodeFromJSON>;

const ENTRY_TYPES = new Set<string>(RICH_TEXT_ENTRY_TYPES);
const HEADING_LEVELS = new Set<number>(RICH_TEXT_HEADING_LEVELS);

const REFERENCE_NODES: Record<string, string> = RICH_TEXT_REFERENCE_NODES;
const REFERENCE_MARKS: Record<string, string> = RICH_TEXT_REFERENCE_MARKS;

// The node types whose reference points at an entry, and so carry an entryType beside the id
const ENTRY_NODES = new Set(["entryEmbed", "entryInline"]);

/**
 * Parses a body into the document this CMS stores, or throws saying why it is not one.
 *
 * The editor only produces valid documents, but the endpoint accepts JSON from anywhere, and a body
 * is rendered straight into published pages. So it is parsed with the editor's own schema, which
 * refuses unknown node and mark types and content in the wrong place, and the result is what gets
 * stored: attributes the schema does not define are dropped rather than carried through. The checks
 * after that are the values a schema cannot express — a link that could run script, a table span
 * that could stall the renderer, a reference with no id to resolve.
 */
export function parseDocument(doc: unknown): RichTextNode {
  if (Buffer.byteLength(JSON.stringify(doc) ?? "") > RICH_TEXT_MAX_BYTES)
    throw new BadRequestException(
      `The body is larger than ${RICH_TEXT_MAX_BYTES / 1024 / 1024} MB`,
    );

  if (!isNode(doc) || doc.type !== "doc")
    throw new BadRequestException("The body must be a document");

  let parsed: DocumentNode;
  try {
    parsed = RICH_TEXT_SCHEMA.nodeFromJSON(doc);
    parsed.check();
  } catch (error) {
    throw new BadRequestException(
      `The body is not a valid document: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const visit = (node: DocumentNode, path: string) => {
    assertNodeAttributes(node, path);
    for (const [index, mark] of node.marks.entries())
      assertMarkAttributes(
        mark.type.name,
        mark.attrs,
        `${path}.marks[${index}]`,
      );
    node.forEach((child, _offset, index) => {
      visit(child, `${path}.content[${index}]`);
    });
  };
  visit(parsed, "body");

  return parsed.toJSON() as RichTextNode;
}

/** Every CTA, image and entry a document points at. */
export function collectReferences(doc: RichTextNode): RichTextReferences {
  const references: RichTextReferences = {
    ctaIds: new Set(),
    mediaIds: new Set(),
    entries: [],
  };

  const record = (kind: string, attrs: Record<string, unknown> | undefined) => {
    if (kind === "ctaEmbed") references.ctaIds.add(String(attrs?.ctaId));
    else if (kind === "mediaEmbed" || kind === "assetLink")
      references.mediaIds.add(String(attrs?.mediaId));
    else if (ENTRY_NODES.has(kind) || kind === "entryLink")
      references.entries.push({
        type: attrs?.entryType as RichTextEntryType,
        id: String(attrs?.entryId),
      });
  };

  walk(doc, "body", (node) => {
    record(node.type, node.attrs);
    for (const mark of node.marks ?? []) record(mark.type, mark.attrs);
  });

  return references;
}

/** Source-Space id → cloned-Space id, per kind of record a document can point at. */
export interface ReferenceMaps {
  cta: Map<Cta["id"], Cta["id"]>;
  entries: {
    blog: Map<Blog["id"], Blog["id"]>;
    category: Map<Category["id"], Category["id"]>;
    tag: Map<Tag["id"], Tag["id"]>;
    author: Map<Author["id"], Author["id"]>;
  };
}

/**
 * Points a copied document's references at the copies rather than the originals — what a Space
 * clone needs. Without it a cloned post embeds the source Space's CTAs, so deleting or editing a
 * CTA in Production silently changes pages in Staging.
 *
 * Images are not remapped: the media library is global, so both Spaces share one image. An
 * id with no mapping is kept rather than dropped, because dropping it would delete content from the
 * copy; given every row in a Space is cloned, a miss means it was already dangling.
 */
export function remapReferences(
  doc: RichTextNode,
  maps: ReferenceMaps,
): RichTextNode {
  const remapAttrs = (
    kind: string,
    attrs: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined => {
    if (!attrs) return attrs;

    if (kind === "ctaEmbed") {
      const next = maps.cta.get(String(attrs.ctaId));
      return next ? { ...attrs, ctaId: next } : attrs;
    }

    if (ENTRY_NODES.has(kind) || kind === "entryLink") {
      const map = maps.entries[attrs.entryType as RichTextEntryType];
      const next = map?.get(String(attrs.entryId));
      return next ? { ...attrs, entryId: next } : attrs;
    }

    return attrs;
  };

  const remap = (node: RichTextNode): RichTextNode => ({
    ...node,
    ...(node.attrs ? { attrs: remapAttrs(node.type, node.attrs) } : {}),
    ...(node.marks
      ? {
          marks: node.marks.map((mark) => ({
            ...mark,
            ...(mark.attrs ? { attrs: remapAttrs(mark.type, mark.attrs) } : {}),
          })),
        }
      : {}),
    ...(node.content ? { content: node.content.map(remap) } : {}),
  });

  return remap(doc);
}

function assertNodeAttributes(node: DocumentNode, path: string) {
  const { name } = node.type;

  if (name === "heading" && !HEADING_LEVELS.has(node.attrs.level))
    throw new BadRequestException(`${path}: heading level must be 1–6`);

  if (name === "tableCell" || name === "tableHeader") {
    for (const span of ["colspan", "rowspan"] as const)
      if (!isIntegerIn(node.attrs[span], 1, RICH_TEXT_TABLE_MAX_SPAN))
        throw new BadRequestException(
          `${path}: ${span} must be between 1 and ${RICH_TEXT_TABLE_MAX_SPAN}`,
        );

    const widths: unknown = node.attrs.colwidth;
    if (
      widths !== null &&
      !(
        Array.isArray(widths) &&
        widths.length <= node.attrs.colspan &&
        widths.every(
          (width) =>
            width === 0 ||
            isIntegerIn(width, 1, RICH_TEXT_TABLE_MAX_COLUMN_WIDTH),
        )
      )
    )
      throw new BadRequestException(`${path}: invalid column widths`);
  }

  const idAttr = REFERENCE_NODES[name];
  if (idAttr) assertReference(node.attrs, idAttr, ENTRY_NODES.has(name), path);
}

function assertMarkAttributes(
  type: string,
  attrs: Record<string, unknown>,
  path: string,
) {
  if (type === "link") {
    if (typeof attrs.href !== "string" || !isSafeHref(attrs.href))
      throw new BadRequestException(
        `${path}: links must be https, http, mailto or a /path on this site`,
      );
    if (attrs.target !== null && attrs.target !== "_blank")
      throw new BadRequestException(`${path}: unsupported link target`);
    // A class would reach the website's own stylesheet — a Tailwind overlay on a link is a page
    // takeover — and rel is fixed so every outbound link carries the same protections
    if (attrs.class !== null)
      throw new BadRequestException(`${path}: links cannot carry a class`);
    if (attrs.rel !== null && attrs.rel !== RICH_TEXT_LINK_REL)
      throw new BadRequestException(`${path}: unsupported link rel`);
  }

  const idAttr = REFERENCE_MARKS[type];
  if (idAttr) assertReference(attrs, idAttr, type === "entryLink", path);
}

const isIntegerIn = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) &&
  (value as number) >= min &&
  (value as number) <= max;

function assertReference(
  attrs: Record<string, unknown> | undefined,
  idAttr: string,
  needsEntryType: boolean,
  path: string,
) {
  const id = attrs?.[idAttr];
  if (typeof id !== "string" || !id)
    throw new BadRequestException(`${path}: missing ${idAttr}`);

  if (needsEntryType && !ENTRY_TYPES.has(String(attrs?.entryType)))
    throw new BadRequestException(
      `${path}: entryType must be one of ${RICH_TEXT_ENTRY_TYPES.join(", ")}`,
    );
}

function isNode(value: unknown): value is RichTextNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RichTextNode).type === "string"
  );
}

/** Depth-first, handing each node its path so a validation error can say where it is. */
function walk(
  node: RichTextNode,
  path: string,
  visit: (node: RichTextNode, path: string) => void,
) {
  visit(node, path);
  for (const [index, child] of (node.content ?? []).entries()) {
    if (!isNode(child))
      throw new BadRequestException(`${path}.content[${index}] is not a node`);
    walk(child, `${path}.content[${index}]`, visit);
  }
}
