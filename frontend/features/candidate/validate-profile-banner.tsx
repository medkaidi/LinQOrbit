"use client";

import { useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { CtaButton } from "@/components/ui/button";
import { useValidateProfile } from "@/hooks/use-candidate-profile";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { CandidateProfile } from "@/types/candidate";

const SUCCESS_DISMISS_MS = 4_000;

const DIRTY_MESSAGE =
  "You've made changes to your professional profile. Validate your profile to refresh its analysis and improve job match results.";
const FAILED_MESSAGE =
  "We could not finish analyzing your profile. You can try again.";

/**
 * Bandeau « profil à valider » : affiché tant que le profil change depuis la
 * dernière normalisation, ou si la dernière tentative a échoué (message
 * générique — le détail reste dans les logs backend/IA). La validation lance
 * le job d'analyse, invalide le cache du profil (bandeau disparaît au refetch)
 * puis montre une confirmation temporaire.
 */
export function ValidateProfileBanner({ profile }: { profile: CandidateProfile }) {
  const validate = useValidateProfile();
  const [validated, setValidated] = useState(false);
  const dismissTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(dismissTimer.current), []);

  function onValidate() {
    validate.mutate(undefined, {
      onSuccess: () => {
        setValidated(true);
        window.clearTimeout(dismissTimer.current);
        dismissTimer.current = window.setTimeout(() => setValidated(false), SUCCESS_DISMISS_MS);
      },
    });
  }

  if (validated) {
    return (
      <Alert variant="success" title="Profile validated">
        Your analysis is being refreshed in the background.
      </Alert>
    );
  }

  const failed = profile.normalizationFailed;

  if (!failed && !profile.hasUnvalidatedChanges) {
    return null;
  }

  return (
    <>
      {validate.isError ? (
        <Alert variant="error" title="Validation failed">
          {getApiErrorMessage(validate.error)}
        </Alert>
      ) : null}
      <Alert
        variant={failed ? "error" : "info"}
        title={failed ? "Last validation attempt failed" : "Profile changes pending"}
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="min-w-0">{failed ? FAILED_MESSAGE : DIRTY_MESSAGE}</span>
          <CtaButton
            icon="task_alt"
            busy={validate.isPending}
            onClick={onValidate}
            className="ml-auto"
          >
            {failed ? "Validate again" : "Validate profile"}
          </CtaButton>
        </span>
      </Alert>
    </>
  );
}
