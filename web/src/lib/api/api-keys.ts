import type {
  ApiKeyResponseDto,
  CreateApiKeyRequestDto,
  CreatedApiKeyResponseDto,
} from "@loom/dto";
import type { ApiKey, Site } from "@loom/dto/models";
import { api, handleError } from "./instance";

export const apiKeys = {
  list: async (siteId: Site["id"]) => {
    try {
      const response = await api.get<ApiResponse<ApiKeyResponseDto[]>>(
        `/sites/${siteId}/api-keys`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load the API keys");
    }
  },

  create: async (siteId: Site["id"], args: CreateApiKeyRequestDto) => {
    try {
      const response = await api.post<ApiResponse<CreatedApiKeyResponseDto>>(
        `/sites/${siteId}/api-keys`,
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to create the API key");
    }
  },

  revoke: async (apiKeyId: ApiKey["id"]) => {
    try {
      const response = await api.post<ApiResponse<ApiKeyResponseDto>>(
        `/api-keys/${apiKeyId}/revoke`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to revoke the API key");
    }
  },
};
