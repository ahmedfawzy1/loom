import type { DashboardRequestDto, DashboardResponseDto } from "@loom/dto";
import { api, handleError } from "./instance";

export const dashboard = {
  get: async (params: DashboardRequestDto) => {
    try {
      const response = await api.get<ApiResponse<DashboardResponseDto>>(
        "/dashboard",
        { params },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the dashboard");
    }
  },
};
