import type {
  CreateCategoryRequestDto,
  ListContentRequestDto,
  UpdateCategoryLocaleRequestDto,
  UpdateCategoryRequestDto,
} from "@loom/dto";
import type { Category, SiteLanguage } from "@loom/dto/models";
import { categories } from "@loom-web/src/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const categoriesKeys = {
  all: ["categories"] as const,
  // `all` is a prefix of `detail`, so invalidating it would also refetch the record a mutation
  // just wrote through setQueryData. Lists invalidate against this narrower key instead.
  lists: () => [...categoriesKeys.all, "list"] as const,
  list: (query: ListContentRequestDto) =>
    [...categoriesKeys.lists(), query] as const,
  detail: (id: Category["id"]) =>
    [...categoriesKeys.all, "detail", id] as const,
};

export const useCategories = (query: ListContentRequestDto, enabled = true) =>
  useQuery({
    queryKey: categoriesKeys.list(query),
    queryFn: () => categories.list(query),
    enabled,
  });

export const useCategory = (id: Category["id"] | undefined) =>
  useQuery({
    queryKey: categoriesKeys.detail(id ?? ""),
    queryFn: () => categories.get(id as Category["id"]),
    enabled: Boolean(id),
  });

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateCategoryRequestDto) => categories.create(args),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: categoriesKeys.lists() }),
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      args,
    }: {
      id: Category["id"];
      args: UpdateCategoryRequestDto;
    }) => categories.update(id, args),
    onSuccess: (updated) => {
      queryClient.setQueryData(categoriesKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: categoriesKeys.lists() });
    },
  });
};

export const useUpdateCategoryLocale = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      language,
      args,
    }: {
      id: Category["id"];
      language: SiteLanguage["code"];
      args: UpdateCategoryLocaleRequestDto;
    }) => categories.updateLocale(id, language, args),
    onSuccess: (updated) => {
      queryClient.setQueryData(categoriesKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: categoriesKeys.lists() });
    },
  });
};
