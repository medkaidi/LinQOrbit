import type { ReactNode } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type MenuItemTone = "default" | "danger";

const itemToneClasses: Record<MenuItemTone, string> = {
  default: "text-text-primary",
  danger: "text-danger",
};
const itemIconToneClasses: Record<MenuItemTone, string> = {
  default: "text-text-secondary",
  danger: "",
};

/**
 * Panneau d'un menu déroulant (`role="menu"`, ouvert sous son déclencheur) —
 * la largeur vient du `className` de l'appelant (`w-48`, `w-64`…). Le
 * déclencheur et la fermeture (clic extérieur, Échap) restent à l'appelant.
 */
export function MenuPanel({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="menu"
      aria-label={label}
      className={cn(
        "absolute right-0 top-full mt-2 rounded-2xl bg-canvas-white border border-slate-border shadow-md p-2 z-50 origin-top-right transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:scale-95 motion-reduce:transition-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Élément d'un menu déroulant : composé sur `Button`/`ButtonLink` (variante
 * `menu` — anatomie de ligne, jamais une pilule) — bouton (défaut) ou lien
 * (`href`), icône à gauche ; `tone="danger"` pour l'action destructive
 * (texte et glyphe rouges).
 */
export function MenuItem({
  icon,
  tone = "default",
  href,
  onClick,
  children,
}: {
  icon: string;
  tone?: MenuItemTone;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const content = (
    <>
      <Icon name={icon} className={cn("text-[18px]", itemIconToneClasses[tone])} />
      {children}
    </>
  );

  if (href) {
    return (
      <ButtonLink
        href={href}
        variant="menu"
        role="menuitem"
        onClick={onClick}
        className={itemToneClasses[tone]}
      >
        {content}
      </ButtonLink>
    );
  }

  return (
    <Button
      type="button"
      variant="menu"
      role="menuitem"
      onClick={onClick}
      className={itemToneClasses[tone]}
    >
      {content}
    </Button>
  );
}

/** Filet de séparation entre un groupe d'éléments et l'action destructive. */
export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-slate-border" />;
}
