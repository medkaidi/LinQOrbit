import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type NavPillProps = {
  /** Icône Material Symbols du badge circulaire. */
  icon: string;
  label: string;
  /** Si fourni, rend un lien de navigation ; sinon un bouton (action locale). */
  href?: string;
  /** Accents de survol (défaut `primary` = orange). */
  tone?: NavPillTone;
  className?: string;
};

export type NavPillTone = "primary" | "secondary" | "danger" | "neutral";

/** Accents de survol : bordure de la pilule, badge et libellé/icône colorés ensemble. */
const pillToneClasses: Record<NavPillTone, { pill: string; badge: string; accent: string }> = {
  primary: {
    pill: "hover:border-orange-border-strong focus-visible:outline-orange-deep",
    badge: "group-hover:border-primary-container group-hover:bg-orange-subtle",
    accent: "group-hover:text-orange-deep",
  },
  secondary: {
    pill: "hover:border-blue-deep focus-visible:outline-blue-deep",
    badge: "group-hover:border-blue-deep group-hover:bg-blue-surface",
    accent: "group-hover:text-blue-deep",
  },
  danger: {
    pill: "hover:border-danger focus-visible:outline-danger",
    badge: "group-hover:border-danger group-hover:bg-danger-container",
    accent: "group-hover:text-danger",
  },
  neutral: {
    pill: "hover:border-slate-muted focus-visible:outline-slate-muted",
    badge: "group-hover:border-slate-muted group-hover:bg-slate-surface",
    accent: "group-hover:text-slate-ink",
  },
};

const baseClasses =
  "group inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-canvas-white border border-slate-border transition-[border-color] duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * Pilule de navigation du dashboard : badge circulaire à gauche, libellé à
 * droite. Standard pour les CTA qui changent de page (« New campaign »,
 * « Edit profile »…). Les accents de survol suivent le `tone`.
 */
export function NavPill({ icon, label, href, tone = "primary", className }: NavPillProps) {
  const toneClasses = pillToneClasses[tone];
  const content = (
    <>
      <span
        className={cn(
          "w-6 h-6 rounded-full bg-canvas-subtle border border-slate-border flex items-center justify-center shrink-0 transition-colors duration-200",
          toneClasses.badge,
        )}
      >
        <Icon
          name={icon}
          className={cn(
            "text-[14px] text-slate-muted transition-colors duration-200",
            toneClasses.accent,
          )}
        />
      </span>
      <span
        className={cn(
          "text-xs font-semibold text-slate-ink tracking-tight transition-colors duration-200",
          toneClasses.accent,
        )}
      >
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn(baseClasses, toneClasses.pill, className)}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={cn(baseClasses, toneClasses.pill, className)}>
      {content}
    </button>
  );
}
