"use client";

import { useState } from "react";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader,
} from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { Spinner } from "@/components/ui/spinner";
import { SuggestedCandidateCard } from "@/features/invitation/suggested-candidate-card";
import { useCompanies } from "@/hooks/use-companies";
import { useInviteCandidate, useSuggestedCandidates } from "@/hooks/use-invitations";
import { useJobOffer } from "@/hooks/use-job-offers";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { SuggestedCandidate } from "@/types/invitation";

/**
 * Candidats suggérés d'une offre publiée (T-101, D85) : le Top N de la
 * recherche faite à la publication, en cartes (les candidats ont consenti à la visibilité de leur profil, T-102). L'invitation (droit
 * de gestion, `canInvite` calculé par le serveur) passe par une confirmation —
 * elle est visible du candidat et ne se retire pas. La liste est un instantané
 * figé : aucun rafraîchissement automatique, aucune relance depuis cette page.
 */
export function SuggestedCandidatesView({ offerId }: { offerId: string }) {
  const offer = useJobOffer(offerId);
  const companies = useCompanies();
  const suggestions = useSuggestedCandidates(offerId);
  const invite = useInviteCandidate(offerId);
  const [target, setTarget] = useState<SuggestedCandidate | null>(null);

  const companyName =
    companies.data?.find((company) => company.id === offer.data?.companyId)?.name ?? null;
  const items = suggestions.data?.items ?? [];
  const canInvite = suggestions.data?.canInvite ?? false;
  // Seule la carte en cours d'invitation est occupée (variables persiste après coup en v5).
  const pendingId = invite.isPending ? invite.variables ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbLink href="/recruiter">Recruiter space</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbCurrent>Suggested candidates</BreadcrumbCurrent>
          </Breadcrumb>
        }
        title="Suggested candidates"
        subtitle={
          offer.data
            ? `${offer.data.title}${companyName ? ` · ${companyName}` : ""}`
            : "Candidates matching this job offer."
        }
        action={
          <ButtonLink href="/recruiter" variant="outline-sm">
            Back to offers
          </ButtonLink>
        }
      />

      <section className={SECTION_CARD_CLASS}>
        <header className={SECTION_HEADER_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Top matches</h2>
          {suggestions.data ? (
            <span className={MUTED_TEXT_CLASS}>
              {items.length === 1 ? "1 candidate" : `${items.length} candidates`}
            </span>
          ) : null}
        </header>

        <div className="px-5 pt-4 pb-5 flex flex-col gap-3">
          <p className={MUTED_TEXT_CLASS}>
            These candidates agreed to share their profile with recruiters. Open a profile to read
            it, or invite a candidate to tell them about this offer — they decide whether to apply.
          </p>

          {suggestions.isLoading ? (
            <span className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
              <Spinner />
              Loading candidates…
            </span>
          ) : null}

          {suggestions.isError ? (
            <Alert variant="error" title="Could not load the suggested candidates">
              <div className="flex items-center justify-between gap-3">
                <span>{getApiErrorMessage(suggestions.error)}</span>
                <Button variant="outline-sm" onClick={() => void suggestions.refetch()}>
                  Retry
                </Button>
              </div>
            </Alert>
          ) : null}

          {invite.error ? (
            <Alert variant="error" title="Invitation failed">
              {getApiErrorMessage(invite.error)}
            </Alert>
          ) : null}

          {suggestions.data && items.length === 0 ? (
            <p className={MUTED_TEXT_CLASS}>No suggested candidates for this offer.</p>
          ) : null}
        </div>
      </section>

      {items.length > 0 ? (
        // Grille sur le fond de page (comme le job board) : une carte dans la section
        // rognerait la largeur de chaque colonne.
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((candidate) => (
            <SuggestedCandidateCard
              key={candidate.id}
              offerId={offerId}
              candidate={candidate}
              canInvite={canInvite}
              busy={pendingId === candidate.id}
              onInvite={setTarget}
            />
          ))}
        </ul>
      ) : null}

      {target ? (
        <ConfirmDialog
          title="Invite this candidate to apply?"
          message="They will see the invitation in their applications. An invitation cannot be withdrawn."
          confirmLabel="Invite"
          icon="send"
          busy={invite.isPending}
          onConfirm={() => invite.mutate(target.id, { onSettled: () => setTarget(null) })}
          onCancel={() => setTarget(null)}
        />
      ) : null}
    </div>
  );
}
