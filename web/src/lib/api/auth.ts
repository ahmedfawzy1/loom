import type {
  ChangePasswordRequestDto,
  CurrentUserResponseDto,
  LoginRequestDto,
  PasswordLinkDetailsResponseDto,
  SetPasswordRequestDto,
} from "@loom/dto";
import { api, handleError } from "./instance";

/** The signed-in person, and signing in and out. The session itself is an httpOnly cookie. */
export const auth = {
  getCurrentUser: async () => {
    try {
      const response =
        await api.get<ApiResponse<CurrentUserResponseDto>>("/me");
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Failed to load your account");
    }
  },

  login: async (args: LoginRequestDto) => {
    try {
      const response = await api.post<ApiResponse<CurrentUserResponseDto>>(
        "/auth/login",
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Couldn't sign in. Try again.", {
        detailOnly: true,
      });
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      throw handleError(error, "Failed to sign out");
    }
  },

  /** Whose account a password link is for, before they choose a password. */
  passwordLink: async (token: string) => {
    try {
      const response = await api.post<
        ApiResponse<PasswordLinkDetailsResponseDto>
      >("/auth/password-link", { token });
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Couldn't open this link. Try again.", {
        detailOnly: true,
      });
    }
  },

  /** Chooses a password through a link, and signs in. */
  setPassword: async (args: SetPasswordRequestDto) => {
    try {
      const response = await api.post<ApiResponse<CurrentUserResponseDto>>(
        "/auth/set-password",
        args,
      );
      return response.data.data;
    } catch (error) {
      throw handleError(error, "Couldn't set your password. Try again.", {
        detailOnly: true,
      });
    }
  },

  changePassword: async (args: ChangePasswordRequestDto) => {
    try {
      await api.put("/auth/password", args);
    } catch (error) {
      throw handleError(error, "Couldn't change your password. Try again.", {
        detailOnly: true,
      });
    }
  },
};
