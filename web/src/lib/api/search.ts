import type { SearchRequestDto, SearchResultResponseDto } from "@loom/dto";
import { api, handleError } from "./instance";

export const search = {
  query: async (params: SearchRequestDto) => {
    try {
      const response = await api.get<ApiResponse<SearchResultResponseDto[]>>(
        "/search",
        { params },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Search failed");
    }
  },
};
