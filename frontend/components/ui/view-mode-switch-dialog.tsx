"use client";

import { Button, CtaButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export const SWITCH_TO_RECRUITER_TITLE = "Switch to the recruiter workspace";

/**
 * Message d'essai recruteur — source unique partagée par le modal de
 * bascule (candidate → recruiter) et la carte d'essai du workspace (D16).
 */
export function RecruiterTrialNotice() {
  return (
    <p className="text-body-md font-body-md text-text-primary leading-relaxed">
      LinQOrbit for recruiters is a paid plan, free for a 14-day trial. Create
      your recruiter profile, set up your company, and start publishing job
      offers — no credit card required.
    </p>
  );
}

/**
 * Confirmation avant de quitter le profil candidat : le message de l'essai et
 * le bouton de basclement s'affichent sans naviguer ; le workspace recruteur
 * gère ensuite son propre onboarding (404 → création du profil, D16).
 */
export function ViewModeSwitchDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      title={SWITCH_TO_RECRUITER_TITLE}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outline-sm" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <CtaButton icon="badge" type="button" onClick={onConfirm}>
            Switch to recruiter
          </CtaButton>
        </>
      }
    >
      <RecruiterTrialNotice />
    </Dialog>
  );
}
