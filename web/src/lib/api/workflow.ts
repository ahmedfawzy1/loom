import type {
  BlockingReferenceResponseDto,
  BulkRequestDto,
  BulkResultResponseDto,
  ContentItemResponseDto,
  ContentPreviewResponseDto,
  ContentVersionDetailResponseDto,
  ContentVersionResponseDto,
  LiveUsageResponseDto,
  LocaleStateResponseDto,
  PreviewLinkResponseDto,
  RequestChangesRequestDto,
  ReviewQueueItemResponseDto,
  TrashItemResponseDto,
} from "@loom/dto";
import { CONTENT_TYPE_PATHS } from "@loom/dto/constants";
import type {
  BlogVersion,
  CmsContentType,
  SiteLanguage,
  Space,
} from "@loom/dto/models";
import { api, handleError } from "./instance";

/** The address of one locale of one item, which every workflow step takes. */
export interface LocaleRef {
  type: CmsContentType;
  id: ContentItemResponseDto["id"];
  language: SiteLanguage["code"];
}

const itemPath = (type: CmsContentType, id: ContentItemResponseDto["id"]) =>
  `/content/${CONTENT_TYPE_PATHS[type]}/${id}`;

const localePath = ({ type, id, language }: LocaleRef) =>
  `${itemPath(type, id)}/locales/${language}`;

/** Every publish and review step is a bodiless POST that answers with the locale's new state. */
const step =
  (action: string, failure: string) =>
  async (ref: LocaleRef, body?: RequestChangesRequestDto) => {
    try {
      const response = await api.post<ApiResponse<LocaleStateResponseDto>>(
        `${localePath(ref)}/${action}`,
        body,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, failure);
    }
  };

export const workflow = {
  submit: step("submit", "Failed to submit for review"),
  approve: step("approve", "Failed to approve"),
  requestChanges: step("request-changes", "Failed to request changes"),
  publish: step("publish", "Failed to publish"),
  unpublish: step("unpublish", "Failed to unpublish"),

  versions: async (ref: LocaleRef) => {
    try {
      const response = await api.get<ApiResponse<ContentVersionResponseDto[]>>(
        `${localePath(ref)}/versions`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the version history");
    }
  },

  version: async (ref: LocaleRef, revision: BlogVersion["revision"]) => {
    try {
      const response = await api.get<
        ApiResponse<ContentVersionDetailResponseDto>
      >(`${localePath(ref)}/versions/${revision}`);
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load that version");
    }
  },

  restoreVersion: async (ref: LocaleRef, revision: BlogVersion["revision"]) => {
    try {
      await api.post(`${localePath(ref)}/versions/${revision}/restore`);
    } catch (error) {
      throw handleError(error, "Failed to restore that version");
    }
  },

  /** A short-lived link to this language on the website, opened in draft mode. */
  previewLink: async (ref: LocaleRef) => {
    try {
      const response = await api.post<ApiResponse<PreviewLinkResponseDto>>(
        `${localePath(ref)}/preview-link`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to open the preview");
    }
  },

  /** This language's latest saved version, as the Content API would serve it in draft mode. */
  preview: async (ref: LocaleRef) => {
    try {
      const response = await api.get<ApiResponse<ContentPreviewResponseDto>>(
        `${localePath(ref)}/preview`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the preview");
    }
  },

  duplicate: async (type: CmsContentType, id: ContentItemResponseDto["id"]) => {
    try {
      const response = await api.post<ApiResponse<ContentItemResponseDto>>(
        `${itemPath(type, id)}/duplicate`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to duplicate");
    }
  },

  trash: async (type: CmsContentType, id: ContentItemResponseDto["id"]) => {
    try {
      await api.post(`${itemPath(type, id)}/trash`);
    } catch (error) {
      throw handleError(error, "Failed to move to the Trash");
    }
  },

  restore: async (type: CmsContentType, id: ContentItemResponseDto["id"]) => {
    try {
      await api.post(`${itemPath(type, id)}/restore`);
    } catch (error) {
      throw handleError(error, "Failed to restore");
    }
  },

  purge: async (type: CmsContentType, id: ContentItemResponseDto["id"]) => {
    try {
      await api.delete(itemPath(type, id));
    } catch (error) {
      throw handleError(error, "Failed to delete permanently");
    }
  },

  bulk: async (type: CmsContentType, args: BulkRequestDto) => {
    try {
      const response = await api.post<ApiResponse<BulkResultResponseDto[]>>(
        `/content/${CONTENT_TYPE_PATHS[type]}/bulk`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to run that on the selection");
    }
  },

  blockingReferences: async (ref: LocaleRef) => {
    try {
      const response = await api.get<
        ApiResponse<BlockingReferenceResponseDto[]>
      >(`${localePath(ref)}/blocking-references`);
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to check what this refers to");
    }
  },

  liveUsage: async (type: CmsContentType, id: ContentItemResponseDto["id"]) => {
    try {
      const response = await api.get<ApiResponse<LiveUsageResponseDto[]>>(
        `${itemPath(type, id)}/live-usage`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to check where this is used");
    }
  },

  reviewQueue: async (spaceId: Space["id"]) => {
    try {
      const response = await api.get<ApiResponse<ReviewQueueItemResponseDto[]>>(
        "/review-queue",
        { params: { spaceId } },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the review queue");
    }
  },

  trashList: async (spaceId: Space["id"]) => {
    try {
      const response = await api.get<ApiResponse<TrashItemResponseDto[]>>(
        "/trash",
        { params: { spaceId } },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the Trash");
    }
  },
};
