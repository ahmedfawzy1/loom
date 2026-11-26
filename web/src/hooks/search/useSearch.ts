import type { SearchRequestDto } from "@loom/dto";
import { SEARCH_QUERY_MIN_LENGTH } from "@loom/dto/constants";
import { search } from "@loom-web/src/lib/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const searchKeys = {
  all: ["search"] as const,
  query: (params: SearchRequestDto) => [...searchKeys.all, params] as const,
};

export const useSearch = (params: SearchRequestDto) =>
  useQuery({
    queryKey: searchKeys.query(params),
    queryFn: () => search.query(params),
    enabled:
      Boolean(params.spaceId) &&
      params.q.trim().length >= SEARCH_QUERY_MIN_LENGTH,
    // Keeps the last results up while the next keystroke's arrive, so the list does not flicker
    placeholderData: keepPreviousData,
  });
