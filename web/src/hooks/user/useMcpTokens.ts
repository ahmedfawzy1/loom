import { mcpTokens } from "@loom-web/src/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const mcpTokenKeys = {
  all: ["mcp-tokens"] as const,
};

export const useMcpTokens = () =>
  useQuery({ queryKey: mcpTokenKeys.all, queryFn: mcpTokens.list });

export const useCreateMcpToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mcpTokens.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: mcpTokenKeys.all }),
  });
};

export const useRevokeMcpToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mcpTokens.revoke,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: mcpTokenKeys.all }),
  });
};
