import type { CreateApiKeyRequestDto } from "@loom/dto";
import type { Site } from "@loom/dto/models";
import { apiKeys } from "@loom-web/src/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const apiKeyKeys = {
  all: ["api-keys"] as const,
  list: (siteId: Site["id"] | undefined) =>
    [...apiKeyKeys.all, "list", siteId] as const,
};

export const useApiKeys = (siteId: Site["id"] | undefined) =>
  useQuery({
    queryKey: apiKeyKeys.list(siteId),
    queryFn: () => apiKeys.list(siteId as Site["id"]),
    enabled: Boolean(siteId),
  });

export const useCreateApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      siteId,
      args,
    }: {
      siteId: Site["id"];
      args: CreateApiKeyRequestDto;
    }) => apiKeys.create(siteId, args),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.all }),
  });
};

export const useRevokeApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiKeys.revoke,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.all }),
  });
};
