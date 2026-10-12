"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useViewModeStore } from "@/stores/view-mode-store";

/**
 * Profil sélectionné : source de vérité pour la sidebar, le dashboard, le
 * menu user et la bascule. Entrer sur `/recruiter*` force le mode recruteur
 * (deep link / liens internes) ; jamais l'inverse — ailleurs, le choix de
 * l'utilisateur persiste.
 */
export function useViewMode() {
  const pathname = usePathname();
  const mode = useViewModeStore((state) => state.mode);
  const setMode = useViewModeStore((state) => state.setMode);

  useEffect(() => {
    if (pathname.startsWith("/recruiter") && mode !== "recruiter") {
      setMode("recruiter");
    }
  }, [pathname, mode, setMode]);

  return { mode, setMode };
}
