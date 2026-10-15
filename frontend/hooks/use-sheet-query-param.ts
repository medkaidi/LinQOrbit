"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * État du drawer « Normalized sheet » synchronisé avec l'URL (`?sheet=open`,
 * D39) : un refresh ou un lien partagé rouvrent le drawer, la fermeture nettoie
 * le paramètre. Écriture via `router.replace` (pas de entrée d'historique
 * supplémentaire — le bouton Back quitte la page comme avant).
 */
export function useSheetQueryParam(): [boolean, (open: boolean) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("sheet") === "open",
  );

  const setSheetOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      const params = new URLSearchParams(window.location.search);
      if (next) {
        params.set("sheet", "open");
      } else {
        params.delete("sheet");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  return [open, setSheetOpen];
}
