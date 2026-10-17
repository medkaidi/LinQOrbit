import { create } from "zustand";
import { persist } from "zustand/middleware";

import { useAuthStore } from "@/stores/auth-store";

export type ViewMode = "candidate" | "recruiter";

type ViewModeState = {
  mode: ViewMode;
  byUser: Record<string, ViewMode>;
  setMode: (mode: ViewMode) => void;
  restoreForUser: (userId: string) => void;
};

type PersistedViewMode = Pick<ViewModeState, "mode" | "byUser">;

/**
 * Migration v0 → v1 : l'ancien état global `{ mode }` n'est pas attribuable à
 * un compte — la valeur live est conservée, la map par utilisateur repart vide.
 */
export function migrateViewModePersisted(persisted: unknown): PersistedViewMode {
  const state = (persisted ?? {}) as { mode?: unknown };
  return {
    mode: state.mode === "recruiter" ? "recruiter" : "candidate",
    byUser: {},
  };
}

/**
 * Préférence de mode **par utilisateur** (persistée sous `byUser[userId]`) :
 * `mode` reste la valeur live lue par le chrome, synchronisée à chaque
 * `setMode` (sous le compte connecté via le store auth) et à chaque login via
 * `restoreForUser`. Un compte partagé sur le même navigateur ne récupère donc
 * jamais le mode d'un autre ; sans session, `setMode` ne fait que la valeur
 * live (non attribuable).
 */
export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set) => ({
      mode: "candidate",
      byUser: {},
      setMode: (mode) =>
        set((state) => {
          const userId = useAuthStore.getState().user?.id;
          if (!userId) {
            return { mode };
          }
          return { mode, byUser: { ...state.byUser, [userId]: mode } };
        }),
      restoreForUser: (userId) =>
        set((state) => ({ mode: state.byUser[userId] ?? "candidate" })),
    }),
    {
      name: "linqorbit.viewMode",
      version: 1,
      partialize: ({ mode, byUser }) => ({ mode, byUser }),
      migrate: migrateViewModePersisted,
    },
  ),
);
