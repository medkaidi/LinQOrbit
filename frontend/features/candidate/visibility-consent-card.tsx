"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { ViewSection } from "@/features/candidate/profile-shared";
import { useSetVisibilityConsent, useVisibilityConsent } from "@/hooks/use-candidate-profile";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { formatShortDate } from "@/lib/utils/format";

/**
 * Consentement à la visibilité du profil par les recruteurs (T-102, D86), en
 * tête de /profile. **Opt-in** : la case est décochée tant que le candidat n'a
 * pas accepté, et il n'est alors jamais proposé à un recruteur. Le texte dit
 * qui voit quoi, pour quoi, ce qui reste privé (e-mail, téléphone) et que le
 * retrait est possible à tout moment — il masque aussitôt le profil des
 * listes. La case s'enregistre à l'action (pas de bouton), l'état affiché est
 * celui que le serveur a enregistré.
 */
export function VisibilityConsentCard() {
  const consent = useVisibilityConsent();
  const save = useSetVisibilityConsent();

  const consented = consent.data?.consented ?? false;
  const since = consent.data?.consentedAt ?? null;

  return (
    <ViewSection id="visibility" title="Visibility to recruiters" icon="shield_person">
      <div className="flex flex-col gap-3">
        <p className="max-w-3xl text-body-sm font-body-sm text-text-secondary">
          When you agree, recruiters whose published job offers match your profile can view your
          full profile, including your name, and invite you to apply. They cannot see your email
          address or phone number. You can withdraw at any time — your profile then disappears from their lists.
          Until you agree, you are never suggested to recruiters.
        </p>

        {consent.isLoading ? (
          <span className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
            <Spinner />
            Loading…
          </span>
        ) : null}

        {consent.isError ? (
          <Alert variant="error" title="Could not load your visibility setting">
            <div className="flex items-center justify-between gap-3">
              <span>{getApiErrorMessage(consent.error)}</span>
              <Button variant="outline-sm" type="button" onClick={() => void consent.refetch()}>
                Retry
              </Button>
            </div>
          </Alert>
        ) : null}

        {consent.data ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Checkbox
              label="Let recruiters view my full profile and invite me to apply"
              checked={consented}
              disabled={save.isPending}
              onChange={(event) => save.mutate(event.target.checked)}
            />
            {save.isPending ? <Spinner /> : null}
            {consented && since ? (
              <span className="text-body-sm font-body-sm text-text-tertiary">
                Shared since {formatShortDate(since)}
              </span>
            ) : null}
          </div>
        ) : null}

        {save.error ? (
          <Alert variant="error" title="Could not save your choice">
            {getApiErrorMessage(save.error)}
          </Alert>
        ) : null}
      </div>
    </ViewSection>
  );
}
