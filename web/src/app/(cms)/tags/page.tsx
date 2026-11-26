import { TagList } from "@loom-web/src/components/tag/TagList";
import { parseStatusParam } from "@loom-web/src/lib/content/status-param";

export default async function TagPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <TagList initialStatus={parseStatusParam(status)} />;
}
