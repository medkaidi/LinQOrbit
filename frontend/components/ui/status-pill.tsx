import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/** Tons d'une pastille-à-point : surface de la pilule + couleur du point. */
export type StatusPillTone = { pill: string; dot: string };

/**
 * Pastille de statut à point coloré : gabarit unique des familles offre /
 * candidature / compte (TD-042) — seuls les tons et le libellé varient
 * (casse de phrase depuis l'inversion de casse v5).
 */
export function StatusPill({ tone, children }: { tone: StatusPillTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-caps text-label-caps normal-case tracking-normal font-bold shrink-0",
        tone.pill,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", tone.dot)} />
      {children}
    </span>
  );
}
