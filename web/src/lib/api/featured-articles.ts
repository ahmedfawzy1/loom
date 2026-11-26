import type {
  FeaturedArticlesResponseDto,
  UpdateFeaturedArticlesRequestDto,
} from "@loom/dto";
import type { SiteLanguage, Space } from "@loom/dto/models";
import { api, handleError } from "./instance";

export const featuredArticles = {
  get: async (spaceId: Space["id"]) => {
    try {
      const response = await api.get<ApiResponse<FeaturedArticlesResponseDto>>(
        `/spaces/${spaceId}/featured-articles`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the featured articles");
    }
  },

  updateLocale: async (
    spaceId: Space["id"],
    language: SiteLanguage["code"],
    args: UpdateFeaturedArticlesRequestDto,
  ) => {
    try {
      const response = await api.put<ApiResponse<FeaturedArticlesResponseDto>>(
        `/spaces/${spaceId}/featured-articles/locales/${language}`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save the featured articles");
    }
  },
};
