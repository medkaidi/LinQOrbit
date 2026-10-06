import type { ComponentPropsWithRef } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "outline" | "outline-sm" | "ghost" | "soft" | "cta";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "group relative overflow-hidden w-full h-12 rounded-full bg-primary-container hover:bg-orange-deep text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-[background-color,box-shadow,scale] duration-150 ease-out active:scale-[0.97] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
  outline:
    "group flex items-center justify-center gap-2 h-11 px-3 rounded-full bg-surface-container-lowest shadow-sm hover:bg-canvas-subtle transition-[background-color,box-shadow,scale] duration-150 ease-out active:scale-[0.97] cursor-pointer",
  "outline-sm":
    "group inline-flex items-center justify-center gap-2 h-8 px-4 rounded-full bg-surface-container-lowest shadow-sm hover:bg-canvas-subtle text-text-primary font-bold text-xs transition-[background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep disabled:opacity-60 disabled:cursor-not-allowed",
  ghost:
    "group flex items-center justify-center gap-2 h-12 px-3 rounded-full text-body-md font-body-md text-text-secondary hover:text-text-primary hover:bg-canvas-subtle transition-[background-color,box-shadow,scale] duration-150 ease-out active:scale-[0.97] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none",
  // Pilule orange « secondaire » des en-têtes : fond orange pâle, libellé gras,
  // icône à gauche ajoutée par l'appelant (souvent une action à venir, désactivée).
  soft: "flex items-center gap-2 px-4 py-2 rounded-full bg-orange-subtle border border-primary-fixed-dim text-orange-deep font-bold text-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
  // CTA standard de la plateforme : géométrie, typo et transitions uniquement —
  // la couleur vient du tone (`ctaToneClasses`). Sans w-full ni h-* pour ne pas
  // entrer en conflit avec un className appelant (cn() est un simple join).
  cta: "group inline-flex items-center gap-2 py-1 px-2.5 rounded-full font-bold text-xs transition-[background-color,color] duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none",
};

export type CtaTone = "primary" | "secondary" | "danger" | "neutral";

/** Couleur de la pilule ET du badge, résolue en une seule passe (jamais empilée). */
const ctaToneClasses: Record<CtaTone, { button: string; badge: string }> = {
  primary: {
    button:
      "text-orange-deep hover:text-canvas-white hover:bg-primary-container focus-visible:outline-orange-deep",
    badge: "bg-primary-container group-hover:bg-canvas-white text-canvas-white group-hover:text-primary-container",
  },
  secondary: {
    button: "text-blue-deep hover:text-canvas-white hover:bg-blue-deep focus-visible:outline-blue-deep",
    badge: "bg-blue-deep group-hover:bg-canvas-white text-canvas-white group-hover:text-blue-deep",
  },
  danger: {
    button: "text-danger hover:text-canvas-white hover:bg-danger focus-visible:outline-danger",
    badge: "bg-danger group-hover:bg-canvas-white text-canvas-white group-hover:text-danger",
  },
  neutral: {
    button: "text-text-primary hover:bg-slate-border focus-visible:outline-text-primary",
    badge: "bg-slate-surface text-text-primary group-hover:bg-canvas-white",
  },
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={cn(variantClasses[variant], className)} {...props} />;
}

export type CtaButtonProps = ButtonProps & {
  /** Glyphe Material Symbols du badge circulaire. */
  icon: string;
  /** Classes d'effet sur l'icône (ex. `animate-spin` pendant l'enregistrement). */
  iconClassName?: string;
  /** Couleur de la pilule et du badge (défaut `primary` = orange). */
  tone?: CtaTone;
};

/**
 * CTA standard de la plateforme : pilule + badge circulaire qui s'inverse au
 * survol, coloré par `tone` (« Save changes », « Upload CV »,
 * « Apply to my profile », « Remove »).
 * Une seule définition du badge — jamais recopiée par les appelants.
 */
export function CtaButton({
  icon,
  iconClassName,
  tone = "primary",
  className,
  children,
  ...props
}: CtaButtonProps) {
  const toneClasses = ctaToneClasses[tone];
  return (
    <Button variant="cta" className={cn(toneClasses.button, className)} {...props}>
      <span
        className={cn(
          "w-6 h-6 -ml-1.5 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200",
          toneClasses.badge,
        )}
      >
        <Icon name={icon} className={cn("text-[14px]", iconClassName)} />
      </span>
      <span className="leading-none transition-colors duration-200">{children}</span>
    </Button>
  );
}
