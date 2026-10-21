"use client";

import { Alert } from "@/components/ui/alert";
import { CtaButton } from "@/components/ui/button";
import { useValidateProfile } from "@/hooks/use-candidate-profile";
import { useCandidateNormalizationStream } from "@/hooks/use-normalization-stream";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { CandidateProfile } from "@/types/candidate";

const DIRTY_MESSAGE =
  "You've made changes to your professional profile. Validate your profile to refresh its analysis and improve job match results.";
const FAILED_MESSAGE =
  "We could not finish analyzing your profile. You can try again.";
const ANALYZING_MESSAGE =
  "Your profile is being analyzed in the background. This can take a few seconds.";
const OUTDATED_MESSAGE =
  "Your profile analysis was made with an earlier version of our analysis. Validate again to refresh it and keep job matching available.";

/** État affiché par le bandeau quand une action de validation est proposée. */
type PendingState = "failed" | "outdated" | "dirty";

const PENDING_CONTENT: Record<
  PendingState,
  { variant: "error" | "info"; title: string; message: string; action: string }
> = {
  failed: {
    variant: "error",
    title: "Last validation attempt failed",
    message: FAILED_MESSAGE,
    action: "Validate again",
  },
  outdated: {
    variant: "info",
    title: "Profile analysis outdated",
    message: OUTDATED_MESSAGE,
    action: "Validate again",
  },
  dirty: {
    variant: "info",
    title: "Profile changes pending",
    message: DIRTY_MESSAGE,
    action: "Validate profile",
  },
};

function pendingState(profile: CandidateProfile): PendingState | null {
  if (profile.normalizationFailed) {
    return "failed";
  }
  if (profile.analysisOutdated) {
    return "outdated";
  }
  return profile.hasUnvalidatedChanges ? "dirty" : null;
}

/**
 * Bandeau « profil à valider » : affiché tant que le profil change depuis la
 * dernière normalisation, si la dernière tentative a échoué (message
 * générique — le détail reste dans les logs backend/IA), si la fiche de
 * référence est sur une version de schéma périmée (D63, « Validate again »
 * même sans modification), ou si une analyse est en cours (signal GET,
 * survit à la navigation). Priorité : analyse en cours > échec > analyse
 * obsolète > changements en attente. La validation n'affiche pas de
 * confirmation verte : elle ne fait que lancer l'analyse, dont l'état est
 * déjà porté par « Analysis in progress ». Pendant l'analyse, le flux SSE de
 * normalisation (D64) relit le profil à chaque transition : le bandeau passe
 * seul d'« Analyzing… » à l'état suivant.
 */
export function ValidateProfileBanner({ profile }: { profile: CandidateProfile }) {
  const validate = useValidateProfile();
  useCandidateNormalizationStream(profile.normalizationInProgress);

  function onValidate() {
    validate.mutate();
  }

  if (profile.normalizationInProgress) {
    return (
      <Alert variant="info" title="Analysis in progress">
        {ANALYZING_MESSAGE}
      </Alert>
    );
  }

  const state = pendingState(profile);

  if (state === null) {
    return null;
  }

  const content = PENDING_CONTENT[state];

  return (
    <>
      {validate.isError ? (
        <Alert variant="error" title="Validation failed">
          {getApiErrorMessage(validate.error)}
        </Alert>
      ) : null}
      <Alert
        variant={content.variant}
        title={content.title}
        action={
          <CtaButton
            icon="task_alt"
            busy={validate.isPending}
            onClick={onValidate}
          >
            {content.action}
          </CtaButton>
        }
      >
        {content.message}
      </Alert>
    </>
  );
}
