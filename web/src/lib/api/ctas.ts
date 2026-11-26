import type {
  ContentListResponseDto,
  CreateCtaRequestDto,
  CtaResponseDto,
  ListContentRequestDto,
  UpdateCtaLocaleRequestDto,
  UpdateCtaRequestDto,
} from "@loom/dto";
import type { Cta, SiteLanguage } from "@loom/dto/models";
import { api, handleError } from "./instance";

export const ctas = {
  list: async (query: ListContentRequestDto) => {
    try {
      const response = await api.get<ApiResponse<ContentListResponseDto>>(
        "/ctas",
        { params: query },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load CTAs");
    }
  },

  get: async (id: Cta["id"]) => {
    try {
      const response = await api.get<ApiResponse<CtaResponseDto>>(
        `/ctas/${id}`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the CTA");
    }
  },

  create: async (args: CreateCtaRequestDto) => {
    try {
      const response = await api.post<ApiResponse<CtaResponseDto>>(
        "/ctas",
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to create the CTA");
    }
  },

  update: async (id: Cta["id"], args: UpdateCtaRequestDto) => {
    try {
      const response = await api.patch<ApiResponse<CtaResponseDto>>(
        `/ctas/${id}`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save the CTA");
    }
  },

  updateLocale: async (
    id: Cta["id"],
    language: SiteLanguage["code"],
    args: UpdateCtaLocaleRequestDto,
  ) => {
    try {
      const response = await api.put<ApiResponse<CtaResponseDto>>(
        `/ctas/${id}/locales/${language}`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save this language");
    }
  },
};
