import { auth } from "@loom-web/src/lib/api";
import { useQuery } from "@tanstack/react-query";

export const currentUserKeys = {
  all: ["current-user"] as const,
};

export const useCurrentUser = () =>
  useQuery({
    queryKey: currentUserKeys.all,
    queryFn: auth.getCurrentUser,
    staleTime: Number.POSITIVE_INFINITY,
  });
