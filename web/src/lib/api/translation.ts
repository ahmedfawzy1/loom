import type {
  ContentItemResponseDto,
  TranslateRequestDto,
  TranslationFieldsResponseDto,
  TranslationResultResponseDto,
  TranslationUsageResponseDto,
} from "@loom/dto";
import { CONTENT_TYPE_PATHS } from "@loom/dto/constants";
import type { CmsContentType, Site, SiteLanguage } from "@loom/dto/models";
import { api, handleError } from "./instance";

// Every language is a round of DeepL calls, one after another, and a long post into twenty of them
// runs well past the default timeout
const TRANSLATE_TIMEOUT_MS = 15 * 60_000;

export const translation = {
  translate: async (
    type: CmsContentType,
    id: ContentItemResponseDto["id"],
    args: TranslateRequestDto,
  ) => {
    try {
      const response = await api.post<
        ApiResponse<TranslationResultResponseDto[]>
      >(`/content/${CONTENT_TYPE_PATHS[type]}/${id}/translate`, args, {
        timeout: TRANSLATE_TIMEOUT_MS,
      });
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Translation failed");
    }
  },

  fieldStates: async (
    type: CmsContentType,
    id: ContentItemResponseDto["id"],
  ) => {
    try {
      const response = await api.get<
        ApiResponse<TranslationFieldsResponseDto[]>
      >(`/content/${CONTENT_TYPE_PATHS[type]}/${id}/translation-fields`);
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to check which translations are behind");
    }
  },

  markCurrent: async (
    type: CmsContentType,
    id: ContentItemResponseDto["id"],
    language: SiteLanguage["code"],
  ) => {
    try {
      await api.post(
        `/content/${CONTENT_TYPE_PATHS[type]}/${id}/locales/${language}/mark-current`,
      );
    } catch (error) {
      throw handleError(error, "Failed to mark it up to date");
    }
  },

  usage: async (siteId: Site["id"]) => {
    try {
      const response = await api.get<ApiResponse<TranslationUsageResponseDto>>(
        `/sites/${siteId}/translation-usage`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load DeepL usage");
    }
  },
};
