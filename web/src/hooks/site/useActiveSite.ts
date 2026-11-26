import { useContextStore } from "@loom-web/src/stores/context";
import { useSites } from "./useSiteQueries";

/** The Site the context bar is pointed at, falling back to the first one on a fresh session. */
export const useActiveSite = () => {
  const siteId = useContextStore((state) => state.siteId);
  const { data: sites, isPending, error } = useSites();

  return {
    site: sites?.find((candidate) => candidate.id === siteId) ?? sites?.[0],
    isPending,
    error,
  };
};
