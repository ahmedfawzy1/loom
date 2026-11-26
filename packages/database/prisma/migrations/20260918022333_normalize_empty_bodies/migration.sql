-- The rich-text schema requires a document to hold at least one block, so the old empty body
-- ({"type":"doc","content":[]}) no longer parses. Rewritten to the empty document the editor itself
-- holds: one empty paragraph. Nothing a reader sees changes.
UPDATE "BlogLocale"
SET "body" = '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb
WHERE "body" = '{"type":"doc","content":[]}'::jsonb;

UPDATE "BlogVersion"
SET "snapshot" = jsonb_set("snapshot", '{body}', '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb)
WHERE "snapshot"->'body' = '{"type":"doc","content":[]}'::jsonb;
