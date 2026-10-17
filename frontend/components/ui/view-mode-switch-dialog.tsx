"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Confirmation avant de quitter le profil candidat : le message de l'essai et
 * le bouton de bascule s'affichent sans naviguer ; le workspace recruteur
 * gère ensuite son propre onboarding (404 → création du profil, D16).
 * Exprimée via `ConfirmDialog` (TD-031) — même anatomie que toutes les
 * confirmations de la plateforme.
 */
export function ViewModeSwitchDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      title="Switch to the recruiter workspace"
      message="LinQOrbit for recruiters is a paid plan, free for a 14-day trial. Create your recruiter profile, set up your company, and start publishing job offers — no credit card required."
      confirmLabel="Switch to recruiter"
      icon="badge"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
