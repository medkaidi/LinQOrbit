import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type IndexBadgeTone = "primary" | "secondary";

/** Le tone ne colorie que le chiffre — le gabarit (fond blanc, bordure) est commun. */
const toneClasses: Record<IndexBadgeTone, string> = {
  primary: "text-orange-deep",
  secondary: "text-blue-deep",
};

/**
 * Pastille numérotée d'une liste ou d'une section (« 1.2.3 » des profils, des
 * fiches normalisées) : même gabarit partout, `tone` choisit la couleur du
 * chiffre — `secondary` (bleu) par défaut.
 */
export function IndexBadge({
  tone = "secondary",
  className,
  children,
}: {
  tone?: IndexBadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "w-7 h-7 shrink-0 rounded-full bg-canvas-white border border-slate-border flex items-center justify-center text-[12px] font-semibold",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
