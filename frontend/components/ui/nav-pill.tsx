import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type NavPillProps = {
  /** Icône Material Symbols du badge circulaire. */
  icon: string;
  label: string;
  /** Si fourni, rend un lien de navigation ; sinon un bouton (action locale). */
  href?: string;
  className?: string;
};

const baseClasses =
  "group inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-canvas-white border border-slate-border hover:border-orange-border-strong transition-[border-color] duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

/**
 * Pilule de navigation du dashboard : badge circulaire à gauche, libellé, flèche de
 * navigation à droite. Standard pour les CTA qui changent de page (« New campaign »,
 * « Edit profile »…).
 */
export function NavPill({ icon, label, href, className }: NavPillProps) {
  const content = (
    <>
      <span className="w-6 h-6 rounded-full bg-canvas-subtle border border-slate-border group-hover:border-primary-container group-hover:bg-orange-subtle flex items-center justify-center shrink-0 transition-colors duration-200">
        <Icon
          name={icon}
          className="text-[14px] text-slate-muted group-hover:text-orange-deep transition-colors duration-200"
        />
      </span>
      <span className="text-xs font-semibold text-slate-ink group-hover:text-orange-deep tracking-tight transition-colors duration-200">
        {label}
      </span>
      <Icon
        name="north_east"
        className="text-[14px] text-text-tertiary group-hover:text-primary-container group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-[translate,color] duration-200 ml-0.5"
      />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn(baseClasses, className)}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={cn(baseClasses, className)}>
      {content}
    </button>
  );
}
