import type { Site, Space } from "@loom/dto/models";
import { spaces } from "@loom-web/src/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { siteKeys } from "./useSiteQueries";

export const useCreateSpace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      siteId,
      name,
      cloneFromSpaceId,
    }: {
      siteId: Site["id"];
      name: Space["name"];
      cloneFromSpaceId?: Space["id"];
    }) => spaces.create(siteId, name, cloneFromSpaceId),
    // A clone that times out client-side is an unknown outcome, not a failure — the transaction may
    // still commit. Refetching either way means the sidebar shows what actually happened.
    onSettled: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
};

export const useRenameSpace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      spaceId,
      name,
    }: {
      spaceId: Space["id"];
      name: Space["name"];
    }) => spaces.rename(spaceId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
};

export const useDeleteSpace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      spaceId,
      confirmName,
    }: {
      spaceId: Space["id"];
      confirmName: Space["name"];
    }) => spaces.remove(spaceId, confirmName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
};
