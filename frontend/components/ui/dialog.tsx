"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils/cn";

type DialogProps = {
  /** Titre de l'en-tête ; sert d'accessible name si `ariaLabel` est absent. */
  title: ReactNode;
  /** Sous-titre de l'en-tête. */
  description?: ReactNode;
  /** Accessible name quand il doit différer du titre visible. */
  ariaLabel?: string;
  /** `false` bloque la fermeture par Échap / clic sur le fond (mutation en cours). */
  dismissable?: boolean;
  onClose: () => void;
  /** Emplacement bas de carte : actions alignées entre elles. */
  footer?: ReactNode;
  /**
   * `center` (défaut) : carte centrée `max-w-xl`. `top` : **rideau** qui
   * descend du haut de l'écran, large (`max-w-6xl`) et défilant — détail
   * d'une offre consulté sans quitter le parcours de candidature (D59). La
   * largeur fait partie de la variante (`cn()` ne fusionne pas les classes).
   */
  placement?: "center" | "top";
  /** Classes additionnelles du conteneur (jamais une largeur : elle vient de `placement`). */
  className?: string;
  children: ReactNode;
};

const PLACEMENT_CLASSES = {
  center: { overlay: "items-center", panel: "max-w-xl" },
  top: { overlay: "items-start pt-4", panel: "max-w-6xl max-h-[calc(100vh-2rem)] overflow-y-auto curtain-in" },
} as const;

/**
 * Fenêtre modale de base (fond plein + carte centrée) : fermeture Échap et
 * clic sur le fond, verrou de défilement du body — la seule implémentation de
 * ce shell dans l'application, à consommer par toutes les modales.
 *
 * Rendue en **portal sur `document.body`** : un ancêtre avec `backdrop-blur` /
 * `transform` (ex. la topnav) ferait que le `fixed` s'aligne sur lui et non
 * sur le viewport.
 */
export function Dialog({
  title,
  description,
  ariaLabel,
  dismissable = true,
  onClose,
  footer,
  placement = "center",
  className,
  children,
}: DialogProps) {
  const layout = PLACEMENT_CLASSES[placement];
  const titleId = useId();

  useEffect(() => {
    if (!dismissable) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dismissable, onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const content = (
    <div
      className={cn("fixed inset-0 z-50 flex justify-center p-4", layout.overlay)}
      onClick={dismissable ? onClose : undefined}
    >
      <div className="absolute inset-0 bg-text-primary/40" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        className={cn(
          "relative w-full bg-canvas-white rounded-2xl shadow-xl",
          layout.panel,
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mx-6 pt-4 pb-4 border-b border-slate-border">
          <h2
            id={titleId}
            className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-body-sm font-body-sm text-text-secondary truncate">
              {description}
            </p>
          ) : null}
        </header>
        <div className="px-6 pt-5 pb-6 flex flex-col gap-4">{children}</div>
        {footer ? (
          <footer className="mx-6 pt-4 pb-5 flex items-center justify-between gap-3 border-t border-slate-border">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );

  // Jamais rendue côté serveur (les modales ne s'ouvrent qu'en client).
  return typeof document === "undefined" ? null : createPortal(content, document.body);
}
