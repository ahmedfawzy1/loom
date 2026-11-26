import type {
  CreateBlogRequestDto,
  ListContentRequestDto,
  UpdateBlogLocaleRequestDto,
  UpdateBlogRequestDto,
} from "@loom/dto";
import type { Blog, SiteLanguage } from "@loom/dto/models";
import { blogs } from "@loom-web/src/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const blogsKeys = {
  all: ["blogs"] as const,
  // `all` is a prefix of `detail`, so invalidating it would also refetch the record a mutation
  // just wrote through setQueryData. Lists invalidate against this narrower key instead.
  lists: () => [...blogsKeys.all, "list"] as const,
  list: (query: ListContentRequestDto) =>
    [...blogsKeys.lists(), query] as const,
  detail: (id: Blog["id"]) => [...blogsKeys.all, "detail", id] as const,
};

export const useBlogs = (query: ListContentRequestDto, enabled = true) =>
  useQuery({
    queryKey: blogsKeys.list(query),
    queryFn: () => blogs.list(query),
    enabled,
  });

export const useBlog = (id: Blog["id"] | undefined) =>
  useQuery({
    queryKey: blogsKeys.detail(id ?? ""),
    queryFn: () => blogs.get(id as Blog["id"]),
    enabled: Boolean(id),
  });

export const useCreateBlog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateBlogRequestDto) => blogs.create(args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: blogsKeys.all }),
  });
};

export const useUpdateBlog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      args,
    }: {
      id: Blog["id"];
      args: UpdateBlogRequestDto;
    }) => blogs.update(id, args),
    onSuccess: (updated) => {
      queryClient.setQueryData(blogsKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: blogsKeys.lists() });
    },
  });
};

export const useUpdateBlogLocale = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      language,
      args,
    }: {
      id: Blog["id"];
      language: SiteLanguage["code"];
      args: UpdateBlogLocaleRequestDto;
    }) => blogs.updateLocale(id, language, args),
    onSuccess: (updated) => {
      queryClient.setQueryData(blogsKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: blogsKeys.lists() });
    },
  });
};
