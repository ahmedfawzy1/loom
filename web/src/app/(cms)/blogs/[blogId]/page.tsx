import { BlogForm } from "@loom-web/src/components/blog/BlogForm";

export default async function EditBlogPage({
  params,
}: {
  params: Promise<{ blogId: string }>;
}) {
  const { blogId } = await params;
  return <BlogForm blogId={blogId} />;
}
