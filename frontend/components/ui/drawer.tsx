"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type DrawerProps = {
  /** Titre visible + accessible name si `ariaLabel` est absent. */
  title: ReactNode;
  /** Sous-titre de l'en-tête (nom de l'entité, tronqué). */
  description?: ReactNode;
  /** Accessible name quand il doit différer du titre visible. */
  ariaLabel?: string;
  /** `false` bloque la fermeture par Échap (mutation en cours). */
  dismissable?: boolean;
  onClose: () => void;
  /** Classes additionnelles sur le panneau. */
  className?: string;
  children: ReactNode;
};

/**
 * Panneau latéral droit **non-modal** (D39) : le contenu derrière reste
 * visible, scrollable et cliquable — c'est la comparaison source ↔ fiche qui
 * guide le design, pas une boîte de dialogue bloquante. Fermeture par Échap
 * ou bouton ; focus déplacé au panneau à l'ouverture puis restitué au
 * déclencheur à la fermeture. La **largeur est fournie par l'appelant** via
 * `className` (ici : 50 % du contenu hors sidenav, `SHEET_HALF_WIDTH`) — le
 * composant reste ignorant de la sidenav ; plein écran sous `lg` par défaut.
 * Portail sur `document.body` (même discipline que
 * `Dialog` — un ancêtre `transform` décalerait le `fixed`).
 */
export function Drawer({
  title,
  description,
  ariaLabel,
  dismissable = true,
  onClose,
  className,
  children,
}: DrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => previousFocus.current?.focus();
  }, []);

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

  const content = (
    <div
      role="dialog"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId}
      tabIndex={-1}
      ref={panelRef}
      className={cn(
        "drawer-in fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-canvas-white shadow-2xl outline-none lg:rounded-l-2xl",
        className,
      )}
    >
      <header className="mx-4 flex shrink-0 items-start justify-between gap-4 border-b border-slate-border pt-3 pb-3">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 truncate text-body-sm font-body-sm text-text-secondary">
              {description}
            </p>
          ) : null}
        </div>
        <Button variant="outline-sm" aria-label="Close" onClick={onClose}>
          <Icon name="close" className="text-[14px]" />
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-5">{children}</div>
    </div>
  );

  // Jamais rendu côté serveur (le drawer ne s'ouvre qu'en client).
  return typeof document === "undefined" ? null : createPortal(content, document.body);
}
