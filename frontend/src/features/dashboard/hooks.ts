import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/services/client";

import type { ParentDashboard, StaffDashboard } from "./types";

export const dashboardKeys = {
  parent: ["dashboard", "parent"] as const,
  staff: ["dashboard", "staff"] as const,
};

/** One request for the whole first screen, not six. */
export function useParentDashboard() {
  return useQuery({
    queryKey: dashboardKeys.parent,
    queryFn: async () => {
      const { data } = await apiClient.get<ParentDashboard>("/dashboard/parent/");
      return data;
    },
  });
}

export function useStaffDashboard() {
  return useQuery({
    queryKey: dashboardKeys.staff,
    queryFn: async () => {
      const { data } = await apiClient.get<StaffDashboard>("/dashboard/staff/");
      return data;
    },
  });
}
