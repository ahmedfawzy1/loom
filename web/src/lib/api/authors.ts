import type {
  AuthorResponseDto,
  ContentListResponseDto,
  CreateAuthorRequestDto,
  ListContentRequestDto,
  UpdateAuthorLocaleRequestDto,
  UpdateAuthorRequestDto,
} from "@loom/dto";
import type { Author, SiteLanguage } from "@loom/dto/models";
import { api, handleError } from "./instance";

export const authors = {
  list: async (query: ListContentRequestDto) => {
    try {
      const response = await api.get<ApiResponse<ContentListResponseDto>>(
        "/authors",
        { params: query },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load authors");
    }
  },

  get: async (id: Author["id"]) => {
    try {
      const response = await api.get<ApiResponse<AuthorResponseDto>>(
        `/authors/${id}`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the author");
    }
  },

  create: async (args: CreateAuthorRequestDto) => {
    try {
      const response = await api.post<ApiResponse<AuthorResponseDto>>(
        "/authors",
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to create the author");
    }
  },

  update: async (id: Author["id"], args: UpdateAuthorRequestDto) => {
    try {
      const response = await api.patch<ApiResponse<AuthorResponseDto>>(
        `/authors/${id}`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save the author");
    }
  },

  updateLocale: async (
    id: Author["id"],
    language: SiteLanguage["code"],
    args: UpdateAuthorLocaleRequestDto,
  ) => {
    try {
      const response = await api.put<ApiResponse<AuthorResponseDto>>(
        `/authors/${id}/locales/${language}`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save this language");
    }
  },
};
