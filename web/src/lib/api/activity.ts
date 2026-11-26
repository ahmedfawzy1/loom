import type {
  ActivityListResponseDto,
  ListActivityRequestDto,
} from "@loom/dto";
import { api, handleError } from "./instance";

export const activity = {
  list: async (params: ListActivityRequestDto) => {
    try {
      const response = await api.get<ApiResponse<ActivityListResponseDto>>(
        "/activity",
        { params },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the activity");
    }
  },
};
