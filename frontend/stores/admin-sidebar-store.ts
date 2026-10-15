import { create } from "zustand";
import { persist } from "zustand/middleware";

type AdminSidebarState = {
  collapsed: boolean;
  toggle: () => void;
};

/**
 * Préférence de repli du sidenav admin (D40) : rail icônes ↔ rubriques
 * étendues, persistée sous `linqorbit.adminSidebar` — rechargée à chaque
 * visite de la console.
 */
export const useAdminSidebarStore = create<AdminSidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((state) => ({ collapsed: !state.collapsed })),
    }),
    { name: "linqorbit.adminSidebar" },
  ),
);

export const ADMIN_SIDEBAR_STORAGE_KEY = "linqorbit.adminSidebar";
