import { revalidate } from "@loom-web/src/lib/api";
import { useMutation } from "@tanstack/react-query";

export const useRefreshLivePages = () =>
  useMutation({ mutationFn: revalidate.refreshLivePages });
