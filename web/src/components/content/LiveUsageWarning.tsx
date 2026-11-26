"use client";

import type { ContentItemResponseDto } from "@loom/dto";
import { CmsContentType } from "@loom/dto/models";
import { useLiveUsage } from "@loom-web/src/hooks/content/useWorkflow";
import Link from "next/link";

// The types a live post can show — as its byline, category, tag, or an embed in its body
export const REFERENCED_TYPES: CmsContentType[] = [
  CmsContentType.AUTHOR,
  CmsContentType.CATEGORY,
  CmsContentType.TAG,
  CmsContentType.CTA,
];

// Past this many, the rest are counted rather than listed
const LISTED_POSTS = 5;

/**
 * Which live posts show this item, asked right before it is unpublished or trashed — both take it
 * off every one of them at once, with nothing on the post itself to say so.
 */
export function LiveUsageWarning({
  type,
  id,
  consequence,
}: {
  type: CmsContentType;
  id: ContentItemResponseDto["id"];
  /** What happens, as the start of a sentence: "Unpublishing it", "Moving it to the Trash". */
  consequence: string;
}) {
  const { data: posts, isPending, error } = useLiveUsage(type, id, true);

  if (isPending) return <p>Checking where this is used…</p>;
  if (error) return <p>{error.message}</p>;
  if (!posts.length) return <p>No live post uses it.</p>;

  return (
    <div className="flex flex-col gap-1">
      <p>
        {posts.length === 1
          ? "One live post uses it."
          : `${posts.length} live posts use it.`}{" "}
        {consequence} removes it from{" "}
        {posts.length === 1 ? "that post" : "them"} on the website straight
        away:
      </p>
      <ul className="flex flex-col gap-0.5 ps-3">
        {posts.slice(0, LISTED_POSTS).map((post) => (
          <li key={post.id}>
            <Link className="underline" href={`/blogs/${post.id}`}>
              {post.title}
            </Link>{" "}
            <span className="font-mono text-xs">
              ({post.languageCodes.join(", ")})
            </span>
          </li>
        ))}
        {posts.length > LISTED_POSTS && (
          <li>and {posts.length - LISTED_POSTS} more</li>
        )}
      </ul>
    </div>
  );
}
