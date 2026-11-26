import { CategoryList } from "@loom-web/src/components/category/CategoryList";
import { parseStatusParam } from "@loom-web/src/lib/content/status-param";

export default async function CategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <CategoryList initialStatus={parseStatusParam(status)} />;
}
