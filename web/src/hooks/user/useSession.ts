import { auth } from "@loom-web/src/lib/api";
import { LOGIN_PATH } from "@loom-web/src/lib/auth/redirect";
import { useMutation } from "@tanstack/react-query";

/**
 * Signs out, then loads the sign-in page afresh: a full page load drops every query this tab had
 * cached, rather than leaving it in memory for whoever signs in next.
 */
export const useSignOut = () =>
  useMutation({
    mutationFn: auth.logout,
    onSuccess: () => window.location.assign(LOGIN_PATH),
  });

export const useChangePassword = () =>
  useMutation({ mutationFn: auth.changePassword });
