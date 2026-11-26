import type {
  CreateSiteRequestDto,
  SiteResponseDto,
  UpdateSiteLanguageRequestDto,
  UpdateSiteRequestDto,
} from "@loom/dto";
import type { Site } from "@loom/dto/models";
import { api, handleError } from "./instance";

export const sites = {
  list: async () => {
    try {
      const response = await api.get<ApiResponse<SiteResponseDto[]>>("/sites");
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load sites");
    }
  },

  get: async (siteId: Site["id"]) => {
    try {
      const response = await api.get<ApiResponse<SiteResponseDto>>(
        `/sites/${siteId}`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the site");
    }
  },

  create: async (args: CreateSiteRequestDto) => {
    try {
      const response = await api.post<ApiResponse<SiteResponseDto>>(
        "/sites",
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to create the site");
    }
  },

  update: async (siteId: Site["id"], args: UpdateSiteRequestDto) => {
    try {
      const response = await api.patch<ApiResponse<SiteResponseDto>>(
        `/sites/${siteId}`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to update the site");
    }
  },

  updateProtectedTerms: async (
    siteId: Site["id"],
    protectedTerms: Site["protectedTerms"],
  ) => {
    try {
      const response = await api.patch<ApiResponse<SiteResponseDto>>(
        `/sites/${siteId}/protected-terms`,
        { protectedTerms },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save the protected terms");
    }
  },

  updateLanguages: async (
    siteId: Site["id"],
    languages: UpdateSiteLanguageRequestDto[],
  ) => {
    try {
      const response = await api.patch<ApiResponse<SiteResponseDto>>(
        `/sites/${siteId}/languages`,
        { languages },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save the languages");
    }
  },

  remove: async (siteId: Site["id"], confirmName: Site["name"]) => {
    try {
      await api.delete(`/sites/${siteId}`, { data: { confirmName } });
    } catch (error) {
      throw handleError(error, "Failed to delete the site");
    }
  },
};
