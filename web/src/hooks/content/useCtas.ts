import type {
  CreateCtaRequestDto,
  ListContentRequestDto,
  UpdateCtaLocaleRequestDto,
  UpdateCtaRequestDto,
} from "@loom/dto";
import type { Cta, SiteLanguage } from "@loom/dto/models";
import { ctas } from "@loom-web/src/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const ctasKeys = {
  all: ["ctas"] as const,
  // `all` is a prefix of `detail`, so invalidating it would also refetch the record a mutation
  // just wrote through setQueryData. Lists invalidate against this narrower key instead.
  lists: () => [...ctasKeys.all, "list"] as const,
  list: (query: ListContentRequestDto) => [...ctasKeys.lists(), query] as const,
  detail: (id: Cta["id"]) => [...ctasKeys.all, "detail", id] as const,
};

export const useCtas = (query: ListContentRequestDto, enabled = true) =>
  useQuery({
    queryKey: ctasKeys.list(query),
    queryFn: () => ctas.list(query),
    enabled,
  });

export const useCta = (id: Cta["id"] | undefined) =>
  useQuery({
    queryKey: ctasKeys.detail(id ?? ""),
    queryFn: () => ctas.get(id as Cta["id"]),
    enabled: Boolean(id),
  });

export const useCreateCta = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateCtaRequestDto) => ctas.create(args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ctasKeys.all }),
  });
};

export const useUpdateCta = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, args }: { id: Cta["id"]; args: UpdateCtaRequestDto }) =>
      ctas.update(id, args),
    onSuccess: (updated) => {
      queryClient.setQueryData(ctasKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: ctasKeys.lists() });
    },
  });
};

export const useUpdateCtaLocale = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      language,
      args,
    }: {
      id: Cta["id"];
      language: SiteLanguage["code"];
      args: UpdateCtaLocaleRequestDto;
    }) => ctas.updateLocale(id, language, args),
    onSuccess: (updated) => {
      queryClient.setQueryData(ctasKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: ctasKeys.lists() });
    },
  });
};
