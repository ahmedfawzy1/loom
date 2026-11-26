import type {
  ContentListResponseDto,
  CreateTagRequestDto,
  ListContentRequestDto,
  TagResponseDto,
  UpdateTagLocaleRequestDto,
  UpdateTagRequestDto,
} from "@loom/dto";
import type { SiteLanguage, Tag } from "@loom/dto/models";
import { api, handleError } from "./instance";

export const tags = {
  list: async (query: ListContentRequestDto) => {
    try {
      const response = await api.get<ApiResponse<ContentListResponseDto>>(
        "/tags",
        { params: query },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load tags");
    }
  },

  get: async (id: Tag["id"]) => {
    try {
      const response = await api.get<ApiResponse<TagResponseDto>>(
        `/tags/${id}`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the tag");
    }
  },

  create: async (args: CreateTagRequestDto) => {
    try {
      const response = await api.post<ApiResponse<TagResponseDto>>(
        "/tags",
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to create the tag");
    }
  },

  update: async (id: Tag["id"], args: UpdateTagRequestDto) => {
    try {
      const response = await api.patch<ApiResponse<TagResponseDto>>(
        `/tags/${id}`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save the tag");
    }
  },

  updateLocale: async (
    id: Tag["id"],
    language: SiteLanguage["code"],
    args: UpdateTagLocaleRequestDto,
  ) => {
    try {
      const response = await api.put<ApiResponse<TagResponseDto>>(
        `/tags/${id}/locales/${language}`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save this language");
    }
  },
};
