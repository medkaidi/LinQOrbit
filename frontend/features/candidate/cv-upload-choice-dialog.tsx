"use client";

import { Alert } from "@/components/ui/alert";
import { Button, CtaButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * Choix proposé après la sélection d'un PDF sur `/profile/edit` (D73) : le
 * déposer tel quel comme CV courant, ou l'analyser pour préremplir les
 * sections du profil — dans les deux cas le fichier est conservé.
 */
export function CvUploadChoiceDialog({
  fileName,
  busy,
  error,
  onSaveOnly,
  onAnalyze,
  onCancel,
}: {
  fileName: string;
  /** Dépôt simple en cours : les trois actions sont bloquées. */
  busy: boolean;
  error: string | null;
  onSaveOnly: () => void;
  onAnalyze: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      title="What should we do with this CV?"
      description={fileName}
      dismissable={!busy}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outline" type="button" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <CtaButton
              type="button"
              icon="save"
              tone="secondary"
              busy={busy}
              onClick={onSaveOnly}
            >
              Save the file only
            </CtaButton>
            <CtaButton type="button" icon="auto_awesome" disabled={busy} onClick={onAnalyze}>
              Analyze and update
            </CtaButton>
          </div>
        </>
      }
    >
      {error ? (
        <Alert variant="error" title="Could not save this CV" className="mt-0">
          {error}
        </Alert>
      ) : null}
      <p className="text-body-sm font-body-sm text-text-secondary">
        <span className="font-semibold text-text-primary">Save the file only</span> adds this PDF
        to your CVs and makes it your current CV. Your profile sections stay unchanged.
      </p>
      <p className="text-body-sm font-body-sm text-text-secondary">
        <span className="font-semibold text-text-primary">Analyze and update</span> reads this PDF
        to prefill your experience, education, skills, languages and links. You review the result
        before applying it. The PDF is also saved as your current CV.
      </p>
    </Dialog>
  );
}
