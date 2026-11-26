import { AuthorForm } from "@loom-web/src/components/author/AuthorForm";

export default async function EditAuthorPage({
  params,
}: {
  params: Promise<{ authorId: string }>;
}) {
  const { authorId } = await params;
  return <AuthorForm authorId={authorId} />;
}
