import type {
  BlogResponseDto,
  ContentListResponseDto,
  CreateBlogRequestDto,
  ListContentRequestDto,
  UpdateBlogLocaleRequestDto,
  UpdateBlogRequestDto,
} from "@loom/dto";
import type { Blog, SiteLanguage } from "@loom/dto/models";
import { api, handleError } from "./instance";

export const blogs = {
  list: async (query: ListContentRequestDto) => {
    try {
      const response = await api.get<ApiResponse<ContentListResponseDto>>(
        "/blogs",
        { params: query },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load posts");
    }
  },

  get: async (id: Blog["id"]) => {
    try {
      const response = await api.get<ApiResponse<BlogResponseDto>>(
        `/blogs/${id}`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the post");
    }
  },

  create: async (args: CreateBlogRequestDto) => {
    try {
      const response = await api.post<ApiResponse<BlogResponseDto>>(
        "/blogs",
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to create the post");
    }
  },

  update: async (id: Blog["id"], args: UpdateBlogRequestDto) => {
    try {
      const response = await api.patch<ApiResponse<BlogResponseDto>>(
        `/blogs/${id}`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save the post");
    }
  },

  updateLocale: async (
    id: Blog["id"],
    language: SiteLanguage["code"],
    args: UpdateBlogLocaleRequestDto,
  ) => {
    try {
      const response = await api.put<ApiResponse<BlogResponseDto>>(
        `/blogs/${id}/locales/${language}`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save this language");
    }
  },
};
