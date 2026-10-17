"use client";

import { useRef } from "react";

import { CtaButton, type CtaTone } from "@/components/ui/button";

type UploadButtonProps = {
  /** Libellé au repos (« Upload CV »). */
  label: string;
  /** Libellé pendant l'opération (« Analyzing… ») — sans lui le libellé reste affiché sous le spinner. */
  busyLabel?: string;
  /** Opération en cours : spinner, bouton désactivé, `aria-busy` (geste `busy` de `CtaButton`). */
  busy?: boolean;
  /** Type de fichier accepté par le sélecteur (extension ou mime). */
  accept?: string;
  tone?: CtaTone;
  icon?: string;
  onSelect: (file: File) => void;
};

/**
 * Bouton de sélection de fichier réutilisable (import CV, dépôt de pièce
 * jointe…) : CTA plateforme + input caché **réarmé à chaque clic** (le même
 * fichier reste sélectionnable après un échec). L'appelant décide du sort du
 * fichier (analyse IA, dépôt…).
 */
export function UploadButton({
  label,
  busyLabel,
  busy = false,
  accept,
  tone = "primary",
  icon = "upload_file",
  onSelect,
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <CtaButton
        type="button"
        icon={icon}
        tone={tone}
        busy={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy && busyLabel ? busyLabel : label}
      </CtaButton>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Réarmer l'input pour la prochaine sélection.
          event.target.value = "";
          if (file) {
            onSelect(file);
          }
        }}
      />
    </>
  );
}
