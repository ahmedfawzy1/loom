import type { BulkRequestDto, ContentItemResponseDto } from "@loom/dto";
import { CONTENT_TYPE_PATHS } from "@loom/dto/constants";
import type { BlogVersion, CmsContentType, Space } from "@loom/dto/models";
import { workflow } from "@loom-web/src/lib/api";
import type { LocaleRef } from "@loom-web/src/lib/api/workflow";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const workflowKeys = {
  all: ["workflow"] as const,
  versions: (ref: LocaleRef) =>
    [...workflowKeys.all, "versions", ref.type, ref.id, ref.language] as const,
  version: (ref: LocaleRef, revision: BlogVersion["revision"]) =>
    [...workflowKeys.versions(ref), revision] as const,
  reviewQueue: (spaceId: Space["id"]) =>
    [...workflowKeys.all, "review-queue", spaceId] as const,
  trash: (spaceId: Space["id"]) =>
    [...workflowKeys.all, "trash", spaceId] as const,
  liveUsage: (type: CmsContentType, id: ContentItemResponseDto["id"]) =>
    [...workflowKeys.all, "live-usage", type, id] as const,
};

export type LocaleStep =
  | "submit"
  | "approve"
  | "requestChanges"
  | "publish"
  | "unpublish";

/**
 * A workflow step changes the item (its status, its trash state), its history, and the review queue
 * and Trash that list it. Each type's query keys are rooted at its path, so one prefix per type
 * reaches its detail and its lists without knowing which type's hook module owns them.
 */
function useInvalidateWorkflow() {
  const queryClient = useQueryClient();
  return (type: CmsContentType) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [CONTENT_TYPE_PATHS[type]] }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.all }),
    ]);
}

export const useVersions = (ref: LocaleRef, enabled: boolean) =>
  useQuery({
    queryKey: workflowKeys.versions(ref),
    queryFn: () => workflow.versions(ref),
    enabled,
  });

export const useVersion = (
  ref: LocaleRef,
  revision: BlogVersion["revision"] | null,
) =>
  useQuery({
    queryKey: workflowKeys.version(ref, revision ?? 0),
    queryFn: () => workflow.version(ref, revision as BlogVersion["revision"]),
    enabled: revision !== null,
  });

export const useLocaleStep = () => {
  const invalidate = useInvalidateWorkflow();
  return useMutation({
    mutationFn: ({
      step,
      ref,
      note,
    }: {
      step: LocaleStep;
      ref: LocaleRef;
      note?: string;
    }) => workflow[step](ref, note === undefined ? undefined : { note }),
    onSuccess: (_, { ref }) => invalidate(ref.type),
  });
};

export const useRestoreVersion = () => {
  const invalidate = useInvalidateWorkflow();
  return useMutation({
    mutationFn: ({
      ref,
      revision,
    }: {
      ref: LocaleRef;
      revision: BlogVersion["revision"];
    }) => workflow.restoreVersion(ref, revision),
    onSuccess: (_, { ref }) => invalidate(ref.type),
  });
};

type ItemRef = Pick<ContentItemResponseDto, "type" | "id">;

export const useDuplicate = () => {
  const invalidate = useInvalidateWorkflow();
  return useMutation({
    mutationFn: ({ type, id }: ItemRef) => workflow.duplicate(type, id),
    onSuccess: (_, { type }) => invalidate(type),
  });
};

export const useTrashItem = () => {
  const invalidate = useInvalidateWorkflow();
  return useMutation({
    mutationFn: ({ type, id }: ItemRef) => workflow.trash(type, id),
    onSuccess: (_, { type }) => invalidate(type),
  });
};

export const useRestoreItem = () => {
  const invalidate = useInvalidateWorkflow();
  return useMutation({
    mutationFn: ({ type, id }: ItemRef) => workflow.restore(type, id),
    onSuccess: (_, { type }) => invalidate(type),
  });
};

export const usePurgeItem = () => {
  const invalidate = useInvalidateWorkflow();
  return useMutation({
    mutationFn: ({ type, id }: ItemRef) => workflow.purge(type, id),
    onSuccess: (_, { type }) => invalidate(type),
  });
};

export const useReviewQueue = (spaceId: Space["id"] | null) =>
  useQuery({
    queryKey: workflowKeys.reviewQueue(spaceId ?? ""),
    queryFn: () => workflow.reviewQueue(spaceId as Space["id"]),
    enabled: Boolean(spaceId),
  });

export const useTrashList = (spaceId: Space["id"] | null) =>
  useQuery({
    queryKey: workflowKeys.trash(spaceId ?? ""),
    queryFn: () => workflow.trashList(spaceId as Space["id"]),
    enabled: Boolean(spaceId),
  });

/** One action over a selection; each item reports its own outcome, and the lists refetch. */
export const useBulk = () => {
  const invalidate = useInvalidateWorkflow();
  return useMutation({
    mutationFn: ({
      type,
      args,
    }: {
      type: CmsContentType;
      args: BulkRequestDto;
    }) => workflow.bulk(type, args),
    onSuccess: (_, { type }) => invalidate(type),
  });
};

/** The live posts an item appears on — asked when about to unpublish or trash it. */
export const useLiveUsage = (
  type: CmsContentType,
  id: ContentItemResponseDto["id"],
  enabled: boolean,
) =>
  useQuery({
    queryKey: workflowKeys.liveUsage(type, id),
    queryFn: () => workflow.liveUsage(type, id),
    enabled,
  });
