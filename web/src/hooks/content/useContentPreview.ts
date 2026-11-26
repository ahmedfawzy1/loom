import { type LocaleRef, workflow } from "@loom-web/src/lib/api/workflow";
import { useQuery } from "@tanstack/react-query";

export const contentPreviewKeys = {
  all: ["content-preview"] as const,
  item: ({ type, id, language }: LocaleRef) =>
    [...contentPreviewKeys.all, type, id, language] as const,
};

/**
 * The preview page's content. It lives in its own tab beside the editor, so it refetches whenever
 * that tab comes back into focus: save in the editor, switch tabs, and the preview has caught up.
 */
export const useContentPreview = (ref: LocaleRef | undefined) =>
  useQuery({
    queryKey: ref ? contentPreviewKeys.item(ref) : contentPreviewKeys.all,
    queryFn: () => workflow.preview(ref as LocaleRef),
    enabled: Boolean(ref),
    refetchOnWindowFocus: true,
  });
