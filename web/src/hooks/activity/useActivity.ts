import type { ListActivityRequestDto } from "@loom/dto";
import { activity } from "@loom-web/src/lib/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const activityKeys = {
  all: ["activity"] as const,
  list: (params: ListActivityRequestDto) =>
    [...activityKeys.all, params] as const,
};

export const useActivity = (params: ListActivityRequestDto) =>
  useQuery({
    queryKey: activityKeys.list(params),
    queryFn: () => activity.list(params),
    placeholderData: keepPreviousData,
  });
