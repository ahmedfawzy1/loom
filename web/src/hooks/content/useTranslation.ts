import type {
  ContentItemResponseDto,
  TranslateRequestDto,
  TranslationResultResponseDto,
} from "@loom/dto";
import { CONTENT_TYPE_PATHS } from "@loom/dto/constants";
import type { CmsContentType, Site, SiteLanguage } from "@loom/dto/models";
import { workflowKeys } from "@loom-web/src/hooks/content/useWorkflow";
import { translation } from "@loom-web/src/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const translationKeys = {
  all: ["translation"] as const,
  usage: (siteId: Site["id"]) =>
    [...translationKeys.all, "usage", siteId] as const,
};

export const useTranslationUsage = (siteId: Site["id"] | undefined) =>
  useQuery({
    queryKey: translationKeys.usage(siteId ?? ""),
    queryFn: () => translation.usage(siteId as Site["id"]),
    enabled: Boolean(siteId),
  });

/**
 * Which fields of each translation are behind the source. Keyed under the type's own root, so a
 * save, a translate or a workflow step — which all refetch that root — refetch it too.
 */
export const useTranslationFields = (
  type: CmsContentType,
  id: ContentItemResponseDto["id"],
) =>
  useQuery({
    queryKey: [CONTENT_TYPE_PATHS[type], "translation-fields", id],
    queryFn: () => translation.fieldStates(type, id),
  });

/** A translation writes new versions of the item and spends characters, so both are refetched. */
export const useTranslate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      id,
      args,
    }: {
      type: CmsContentType;
      id: ContentItemResponseDto["id"];
      args: TranslateRequestDto;
    }) => translation.translate(type, id, args),
    onSuccess: (_, { type }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [CONTENT_TYPE_PATHS[type]] }),
        queryClient.invalidateQueries({ queryKey: workflowKeys.all }),
        queryClient.invalidateQueries({ queryKey: translationKeys.all }),
      ]),
  });
};

export const useMarkCurrent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      id,
      language,
    }: {
      type: CmsContentType;
      id: ContentItemResponseDto["id"];
      language: SiteLanguage["code"];
    }) => translation.markCurrent(type, id, language),
    onSuccess: (_, { type }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [CONTENT_TYPE_PATHS[type]] }),
        queryClient.invalidateQueries({ queryKey: workflowKeys.all }),
      ]),
  });
};

/** What translating one item of a selection came to: its languages' results, or why it failed. */
export interface BulkTranslateResult {
  id: ContentItemResponseDto["id"];
  results: Serialized<TranslationResultResponseDto>[];
  error: string | null;
}

/**
 * Translation over a selection: the single-item translate, run once per item in turn, so each item
 * reports as it finishes instead of the whole batch waiting on one very long request.
 */
export const useBulkTranslate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      type,
      ids,
      args,
      onProgress,
    }: {
      type: CmsContentType;
      ids: ContentItemResponseDto["id"][];
      args: TranslateRequestDto;
      onProgress: (finished: number) => void;
    }) => {
      const outcomes: BulkTranslateResult[] = [];
      for (const [index, id] of ids.entries()) {
        try {
          outcomes.push({
            id,
            results: await translation.translate(type, id, args),
            error: null,
          });
        } catch (error) {
          outcomes.push({
            id,
            results: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
        onProgress(index + 1);
      }
      return outcomes;
    },
    onSettled: (_, __, { type }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [CONTENT_TYPE_PATHS[type]] }),
        queryClient.invalidateQueries({ queryKey: workflowKeys.all }),
        queryClient.invalidateQueries({ queryKey: translationKeys.all }),
      ]),
  });
};
