import type { Space } from "@loom/dto/models";
import { api, handleError } from "./instance";

export const revalidate = {
  refreshLivePages: async (spaceId: Space["id"]) => {
    try {
      await api.post("/revalidate", { spaceId });
    } catch (error) {
      throw handleError(error, "Failed to refresh the live pages");
    }
  },
};
