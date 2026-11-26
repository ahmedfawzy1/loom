import type {
  ConfirmMediaRequestDto,
  CreateMediaUploadRequestDto,
  ListMediaRequestDto,
  MediaListResponseDto,
  MediaResponseDto,
  MediaUploadResponseDto,
  MediaUsageResponseDto,
  UpdateMediaRequestDto,
} from "@loom/dto";
import type { Media, PendingUpload } from "@loom/dto/models";
import axios from "axios";
import { api, handleError } from "./instance";

export const media = {
  list: async (query: ListMediaRequestDto) => {
    try {
      const response = await api.get<ApiResponse<MediaListResponseDto>>(
        "/media",
        {
          params: query,
        },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load images");
    }
  },

  get: async (mediaId: Media["id"]) => {
    try {
      const response = await api.get<ApiResponse<MediaResponseDto>>(
        `/media/${mediaId}`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the image");
    }
  },

  usages: async (mediaId: Media["id"]) => {
    try {
      const response = await api.get<ApiResponse<MediaUsageResponseDto[]>>(
        `/media/${mediaId}/usages`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load where this image is used");
    }
  },

  createUpload: async (args: CreateMediaUploadRequestDto) => {
    try {
      const response = await api.post<ApiResponse<MediaUploadResponseDto>>(
        "/media/uploads",
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to start the upload");
    }
  },

  /**
   * Straight to storage through the signed policy — a plain axios call, not the /admin instance,
   * because the bucket is a different origin and must not receive the CMS's own headers. The file
   * goes last: storage ignores any form field that follows it.
   */
  postFile: async (upload: MediaUploadResponseDto, file: File) => {
    const form = new FormData();
    for (const [name, value] of Object.entries(upload.fields))
      form.append(name, value);
    form.append("file", file);

    try {
      await axios.post(upload.url, form);
    } catch (error) {
      throw handleError(
        error,
        "The file did not reach storage — it may be larger or of a different type than declared",
      );
    }
  },

  confirm: async (args: ConfirmMediaRequestDto) => {
    try {
      const response = await api.post<ApiResponse<MediaResponseDto>>(
        "/media",
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "The image was not accepted");
    }
  },

  update: async (mediaId: Media["id"], args: UpdateMediaRequestDto) => {
    try {
      const response = await api.patch<ApiResponse<MediaResponseDto>>(
        `/media/${mediaId}`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to save the image");
    }
  },

  replace: async (mediaId: Media["id"], key: PendingUpload["key"]) => {
    try {
      const response = await api.post<ApiResponse<MediaResponseDto>>(
        `/media/${mediaId}/replace`,
        { key },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "The replacement was not accepted");
    }
  },

  restore: async (mediaId: Media["id"]) => {
    try {
      await api.post(`/media/${mediaId}/restore`);
    } catch (error) {
      throw handleError(error, "Failed to restore the image");
    }
  },

  remove: async (mediaId: Media["id"]) => {
    try {
      await api.delete(`/media/${mediaId}`);
    } catch (error) {
      throw handleError(error, "Failed to delete the image");
    }
  },
};
