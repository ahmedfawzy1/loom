import { ContentPreview } from "@loom-web/src/components/preview/ContentPreview";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Preview · Loom" };

/**
 * The editor's Preview, outside the admin chrome so it reads like the website page it stands for.
 * `?language=` picks the language; without it, the one the CMS is working in.
 */
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  // useSearchParams needs a boundary to render the rest of the page without waiting for it
  return (
    <Suspense>
      <ContentPreview id={id} typePath={type} />
    </Suspense>
  );
}
