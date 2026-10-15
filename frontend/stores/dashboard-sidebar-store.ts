import { create } from "zustand";
import { persist } from "zustand/middleware";

type DashboardSidebarState = {
  collapsed: boolean;
  toggle: () => void;
};

/**
 * Préférence de repli du sidenav dashboard (candidat/recruteur) : rail
 * icônes ↔ rubriques étendues, persistée sous `linqorbit.dashboardSidebar` —
 * rechargée à chaque visite. Store dédié, distinct de l'admin
 * (`linqorbit.adminSidebar`) : deux zones, deux préférences.
 */
export const useDashboardSidebarStore = create<DashboardSidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((state) => ({ collapsed: !state.collapsed })),
    }),
    { name: "linqorbit.dashboardSidebar" },
  ),
);

export const DASHBOARD_SIDEBAR_STORAGE_KEY = "linqorbit.dashboardSidebar";
