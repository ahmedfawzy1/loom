import { BlogList } from "@loom-web/src/components/blog/BlogList";
import { parseStatusParam } from "@loom-web/src/lib/content/status-param";

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <BlogList initialStatus={parseStatusParam(status)} />;
}
