import type { SpaceResponseDto } from "@loom/dto";
import type { Site, Space } from "@loom/dto/models";
import { SPACE_CLONE_CLIENT_TIMEOUT_MS } from "@loom-web/src/constants/timeouts";
import { api, handleError } from "./instance";

export const spaces = {
  list: async (siteId: Site["id"]) => {
    try {
      const response = await api.get<ApiResponse<SpaceResponseDto[]>>(
        `/sites/${siteId}/spaces`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load spaces");
    }
  },

  create: async (
    siteId: Site["id"],
    name: Space["name"],
    cloneFromSpaceId?: Space["id"],
  ) => {
    try {
      const response = await api.post<ApiResponse<SpaceResponseDto>>(
        `/sites/${siteId}/spaces`,
        { name, cloneFromSpaceId },
        // A clone copies every row the source Space holds, which outlasts the instance default.
        // The server's own budget is what should expire first, so this sits above it.
        { timeout: SPACE_CLONE_CLIENT_TIMEOUT_MS },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to create the space");
    }
  },

  rename: async (spaceId: Space["id"], name: Space["name"]) => {
    try {
      const response = await api.patch<ApiResponse<SpaceResponseDto>>(
        `/spaces/${spaceId}`,
        { name },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to rename the space");
    }
  },

  remove: async (spaceId: Space["id"], confirmName: Space["name"]) => {
    try {
      await api.delete(`/spaces/${spaceId}`, { data: { confirmName } });
    } catch (error) {
      throw handleError(error, "Failed to delete the space");
    }
  },
};
