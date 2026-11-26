import type { UpdateFeaturedArticlesRequestDto } from "@loom/dto";
import type { SiteLanguage, Space } from "@loom/dto/models";
import { featuredArticles } from "@loom-web/src/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const featuredArticlesKeys = {
  all: ["featured-articles"] as const,
  detail: (spaceId: Space["id"]) =>
    [...featuredArticlesKeys.all, spaceId] as const,
};

export const useFeaturedArticles = (spaceId: Space["id"] | undefined) =>
  useQuery({
    queryKey: featuredArticlesKeys.detail(spaceId ?? ""),
    queryFn: () => featuredArticles.get(spaceId as Space["id"]),
    enabled: Boolean(spaceId),
  });

export const useUpdateFeaturedArticles = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      spaceId,
      language,
      args,
    }: {
      spaceId: Space["id"];
      language: SiteLanguage["code"];
      args: UpdateFeaturedArticlesRequestDto;
    }) => featuredArticles.updateLocale(spaceId, language, args),
    onSuccess: (updated) =>
      queryClient.setQueryData(
        featuredArticlesKeys.detail(updated.spaceId),
        updated,
      ),
  });
};
