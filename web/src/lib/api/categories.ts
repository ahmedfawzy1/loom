import type {
  CategoryResponseDto,
  ContentListResponseDto,
  CreateCategoryRequestDto,
  ListContentRequestDto,
  UpdateCategoryLocaleRequestDto,
  UpdateCategoryRequestDto,
} from "@loom/dto";
import type { Category, SiteLanguage } from "@loom/dto/models";
import { api, handleError } from "./instance";

export const categories = {
  list: async (query: ListContentRequestDto) => {
    try {
      const response = await api.get<ApiResponse<ContentListResponseDto>>(
        "/categories",
        { params: query },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load categorys");
    }
  },

  get: async (id: Category["id"]) => {
    try {
      const response = await api.get<ApiResponse<CategoryResponseDto>>(
        `/categories/${id}`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the category");
    }
  },

  create: async (args: CreateCategoryRequestDto) => {
    try {
      const response = await api.post<ApiResponse<CategoryResponseDto>>(
        "/categories",
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to create the category");
    }
  },

  update: async (id: Category["id"], args: UpdateCategoryRequestDto) => {
    try {
      const response = await api.patch<ApiResponse<CategoryResponseDto>>(
        `/categories/${id}`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save the category");
    }
  },

  updateLocale: async (
    id: Category["id"],
    language: SiteLanguage["code"],
    args: UpdateCategoryLocaleRequestDto,
  ) => {
    try {
      const response = await api.put<ApiResponse<CategoryResponseDto>>(
        `/categories/${id}/locales/${language}`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save this language");
    }
  },
};
