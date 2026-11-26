import { AuthorList } from "@loom-web/src/components/author/AuthorList";
import { parseStatusParam } from "@loom-web/src/lib/content/status-param";

export default async function AuthorPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <AuthorList initialStatus={parseStatusParam(status)} />;
}
