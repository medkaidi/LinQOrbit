import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const VIEW_MODE_STORAGE_KEY = "linqorbit.viewMode";

export type ViewMode = "candidate" | "recruiter";

type ViewModeState = {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
};

export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set) => ({
      mode: "candidate",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: VIEW_MODE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
