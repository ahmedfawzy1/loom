import { CategoryForm } from "@loom-web/src/components/category/CategoryForm";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  return <CategoryForm categoryId={categoryId} />;
}
