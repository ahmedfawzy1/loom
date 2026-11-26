import type {
  CreatedMcpTokenResponseDto,
  CreateMcpTokenRequestDto,
  McpTokenResponseDto,
} from "@loom/dto";
import type { McpToken } from "@loom/dto/models";
import { api, handleError } from "./instance";

/** The signed-in person's own MCP tokens. Nobody sees or revokes anyone else's. */
export const mcpTokens = {
  list: async () => {
    try {
      const response =
        await api.get<ApiResponse<McpTokenResponseDto[]>>("/mcp-tokens");
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load your MCP tokens");
    }
  },

  create: async (args: CreateMcpTokenRequestDto) => {
    try {
      const response = await api.post<ApiResponse<CreatedMcpTokenResponseDto>>(
        "/mcp-tokens",
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to create the MCP token");
    }
  },

  revoke: async (tokenId: McpToken["id"]) => {
    try {
      const response = await api.post<ApiResponse<McpTokenResponseDto>>(
        `/mcp-tokens/${tokenId}/revoke`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to revoke the MCP token");
    }
  },
};
