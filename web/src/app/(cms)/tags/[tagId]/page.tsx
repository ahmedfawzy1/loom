import { TagForm } from "@loom-web/src/components/tag/TagForm";

export default async function EditTagPage({
  params,
}: {
  params: Promise<{ tagId: string }>;
}) {
  const { tagId } = await params;
  return <TagForm tagId={tagId} />;
}
