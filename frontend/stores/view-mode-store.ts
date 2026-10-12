import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "candidate" | "recruiter";

type ViewModeState = {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
};

/**
 * Profil sélectionné (état UI pur, aucun rôle backend) : la route
 * `/recruiter*` force le mode recruteur à l'entrée (deep link), mais le
 * choix persiste ailleurs (les cartes du dashboard suivent le mode).
 */
export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set) => ({
      mode: "candidate",
      setMode: (mode) => set({ mode }),
    }),
    { name: "linqorbit.viewMode" },
  ),
);

export const VIEW_MODE_STORAGE_KEY = "linqorbit.viewMode";
