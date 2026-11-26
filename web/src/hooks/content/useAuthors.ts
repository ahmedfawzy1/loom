import type {
  CreateAuthorRequestDto,
  ListContentRequestDto,
  UpdateAuthorLocaleRequestDto,
  UpdateAuthorRequestDto,
} from "@loom/dto";
import type { Author, SiteLanguage } from "@loom/dto/models";
import { authors } from "@loom-web/src/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const authorsKeys = {
  all: ["authors"] as const,
  // `all` is a prefix of `detail`, so invalidating it would also refetch the record a mutation
  // just wrote through setQueryData. Lists invalidate against this narrower key instead.
  lists: () => [...authorsKeys.all, "list"] as const,
  list: (query: ListContentRequestDto) =>
    [...authorsKeys.lists(), query] as const,
  detail: (id: Author["id"]) => [...authorsKeys.all, "detail", id] as const,
};

export const useAuthors = (query: ListContentRequestDto, enabled = true) =>
  useQuery({
    queryKey: authorsKeys.list(query),
    queryFn: () => authors.list(query),
    enabled,
  });

export const useAuthor = (id: Author["id"] | undefined) =>
  useQuery({
    queryKey: authorsKeys.detail(id ?? ""),
    queryFn: () => authors.get(id as Author["id"]),
    enabled: Boolean(id),
  });

export const useCreateAuthor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateAuthorRequestDto) => authors.create(args),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: authorsKeys.lists() }),
  });
};

export const useUpdateAuthor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      args,
    }: {
      id: Author["id"];
      args: UpdateAuthorRequestDto;
    }) => authors.update(id, args),
    onSuccess: (updated) => {
      queryClient.setQueryData(authorsKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: authorsKeys.lists() });
    },
  });
};

export const useUpdateAuthorLocale = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      language,
      args,
    }: {
      id: Author["id"];
      language: SiteLanguage["code"];
      args: UpdateAuthorLocaleRequestDto;
    }) => authors.updateLocale(id, language, args),
    onSuccess: (updated) => {
      queryClient.setQueryData(authorsKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: authorsKeys.lists() });
    },
  });
};
