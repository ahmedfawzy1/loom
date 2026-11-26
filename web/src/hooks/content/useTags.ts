import type {
  CreateTagRequestDto,
  ListContentRequestDto,
  UpdateTagLocaleRequestDto,
  UpdateTagRequestDto,
} from "@loom/dto";
import type { SiteLanguage, Tag } from "@loom/dto/models";
import { tags } from "@loom-web/src/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const tagsKeys = {
  all: ["tags"] as const,
  // `all` is a prefix of `detail`, so invalidating it would also refetch the record a mutation
  // just wrote through setQueryData. Lists invalidate against this narrower key instead.
  lists: () => [...tagsKeys.all, "list"] as const,
  list: (query: ListContentRequestDto) => [...tagsKeys.lists(), query] as const,
  detail: (id: Tag["id"]) => [...tagsKeys.all, "detail", id] as const,
};

export const useTags = (query: ListContentRequestDto, enabled = true) =>
  useQuery({
    queryKey: tagsKeys.list(query),
    queryFn: () => tags.list(query),
    enabled,
  });

export const useTag = (id: Tag["id"] | undefined) =>
  useQuery({
    queryKey: tagsKeys.detail(id ?? ""),
    queryFn: () => tags.get(id as Tag["id"]),
    enabled: Boolean(id),
  });

export const useCreateTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateTagRequestDto) => tags.create(args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagsKeys.all }),
  });
};

export const useUpdateTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, args }: { id: Tag["id"]; args: UpdateTagRequestDto }) =>
      tags.update(id, args),
    onSuccess: (updated) => {
      queryClient.setQueryData(tagsKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: tagsKeys.lists() });
    },
  });
};

export const useUpdateTagLocale = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      language,
      args,
    }: {
      id: Tag["id"];
      language: SiteLanguage["code"];
      args: UpdateTagLocaleRequestDto;
    }) => tags.updateLocale(id, language, args),
    onSuccess: (updated) => {
      queryClient.setQueryData(tagsKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: tagsKeys.lists() });
    },
  });
};
