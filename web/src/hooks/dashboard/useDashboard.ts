import type { DashboardRequestDto } from "@loom/dto";
import { dashboard } from "@loom-web/src/lib/api";
import { useQuery } from "@tanstack/react-query";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  get: (params: DashboardRequestDto) => [...dashboardKeys.all, params] as const,
};

export const useDashboard = (params: DashboardRequestDto) =>
  useQuery({
    queryKey: dashboardKeys.get(params),
    queryFn: () => dashboard.get(params),
    enabled: Boolean(params.spaceId),
  });
