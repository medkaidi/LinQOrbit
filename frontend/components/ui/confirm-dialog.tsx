"use client";

import type { ReactNode } from "react";

import { Button, CtaButton, type CtaTone } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export type ConfirmDialogProps = {
  title: ReactNode;
  /** Message de corps (conséquence, irréversibilité…). */
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Couleur du bouton de confirmation (`danger` pour une suppression). */
  tone?: CtaTone;
  /** Glyphe du badge du bouton de confirmation. */
  icon?: string;
  /** Confirmation en cours : spinner, bouton Cancel désactivé, fermeture Échap/fond bloquée. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Boîte de confirmation réutilisable (destructrice ou non) — jamais de
 * `window.confirm`. Montée conditionnellement par l'appelant
 * (`{target ? <ConfirmDialog … /> : null}`), comme les autres modales.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  icon = "check",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      dismissable={!busy}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outline-sm" type="button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <CtaButton type="button" tone={tone} icon={icon} busy={busy} onClick={onConfirm}>
            {confirmLabel}
          </CtaButton>
        </>
      }
    >
      {message ? (
        <p className="text-body-md font-body-md text-text-primary leading-relaxed">{message}</p>
      ) : null}
    </Dialog>
  );
}
