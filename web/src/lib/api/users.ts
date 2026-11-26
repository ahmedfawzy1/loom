import type {
  CmsUserResponseDto,
  ContentUserResponseDto,
  InvitedUserResponseDto,
  InviteUserRequestDto,
  PasswordLinkResponseDto,
} from "@loom/dto";
import type { CmsUser } from "@loom/dto/models";
import { api, handleError } from "./instance";

export const users = {
  directory: async () => {
    try {
      const response =
        await api.get<ApiResponse<ContentUserResponseDto[]>>(
          "/users/directory",
        );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load people");
    }
  },

  list: async () => {
    try {
      const response =
        await api.get<ApiResponse<CmsUserResponseDto[]>>("/users");
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load users");
    }
  },

  /** Adds someone with a role, and returns the link that lets them choose a password — once. */
  invite: async (args: InviteUserRequestDto) => {
    try {
      const response = await api.post<ApiResponse<InvitedUserResponseDto>>(
        "/users",
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to add the user");
    }
  },

  /** A new invite, or a password reset: a link that replaces any they had. */
  createPasswordLink: async (userId: CmsUser["id"]) => {
    try {
      const response = await api.post<ApiResponse<PasswordLinkResponseDto>>(
        `/users/${userId}/password-link`,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to make a password link");
    }
  },

  updateRole: async (userId: CmsUser["id"], role: CmsUser["role"]) => {
    try {
      const response = await api.patch<ApiResponse<CmsUserResponseDto>>(
        `/users/${userId}/role`,
        { role },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to change the role");
    }
  },

  updateStatus: async (userId: CmsUser["id"], status: CmsUser["status"]) => {
    try {
      const response = await api.patch<ApiResponse<CmsUserResponseDto>>(
        `/users/${userId}/status`,
        { status },
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to change the account status");
    }
  },

  remove: async (userId: CmsUser["id"]) => {
    try {
      await api.delete(`/users/${userId}`);
    } catch (error) {
      throw handleError(error, "Failed to delete the user");
    }
  },
};
