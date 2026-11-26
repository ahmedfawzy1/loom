// An empty Tiptap document. A Blog exists before the editor has run, so its body needs a valid
// starting shape rather than null — and the schema requires at least one block, so it is the single
// empty paragraph the editor itself holds when nothing has been written.
export const EMPTY_DOCUMENT = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const;
