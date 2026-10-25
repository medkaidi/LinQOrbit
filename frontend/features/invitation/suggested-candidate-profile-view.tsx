"use client";

import { isAxiosError } from "axios";
import { useState } from "react";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader,
} from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, CtaButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { SECTION_CARD_CLASS } from "@/components/ui/section";
import { Spinner } from "@/components/ui/spinner";
import { candidateInitials } from "@/features/application/recruiter-application-shared";
import { ProfileSections } from "@/features/candidate/profile-view";
import { suggestedCandidateName } from "@/features/invitation/suggested-candidate-card";
import { useInviteCandidate, useSuggestedCandidateProfile } from "@/hooks/use-invitations";
import { useJobOffer } from "@/hooks/use-job-offers";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { AuthUser } from "@/types/auth";
import type { SuggestedCandidateProfile } from "@/types/invitation";

const WITHDRAWN_MESSAGE =
  "This profile is no longer available. The candidate may have withdrawn their consent.";

/**
 * Compte « de lecture » passé à la section About : nom et localisation du
 * candidat consentant, **sans e-mail ni téléphone** (le serveur ne les envoie
 * pas ; l'About affiche « Not available » à leur place).
 */
function readOnlyAccount(data: SuggestedCandidateProfile): AuthUser {
  return {
    id: data.card.id,
    email: "",
    firstName: data.card.firstName ?? "",
    lastName: data.card.lastName ?? "",
    sex: null,
    phone: null,
    homeCountry: null,
    currentCity: data.currentCity,
    currentCountry: data.currentCountry,
    roles: [],
  };
}

/**
 * Profil complet d'un candidat suggéré (T-102, D86) : le candidat a consenti à
 * la visibilité de son profil. Mêmes sections que sa propre vue (lecture
 * seule), sans e-mail ni téléphone (cellules « Not available ») ; le contact
 * passe par l'invitation dans la plateforme (droit de gestion, confirmation,
 * non retirable). Consentement retiré entre-temps (404) : message explicite, jamais de profil périmé.
 */
export function SuggestedCandidateProfileView({
  offerId,
  suggestionId,
}: {
  offerId: string;
  suggestionId: string;
}) {
  const offer = useJobOffer(offerId);
  const profile = useSuggestedCandidateProfile(offerId, suggestionId);
  const invite = useInviteCandidate(offerId);
  const [confirming, setConfirming] = useState(false);

  const data = profile.data;
  const name = data ? suggestedCandidateName(data.card) : "Candidate";
  const position = data?.card.title?.trim() || data?.profile.about.title?.trim() || null;
  const status = data?.card.status;
  const listHref = `/recruiter/offers/${offerId}/suggestions`;
  const withdrawn = isAxiosError(profile.error) && profile.error.response?.status === 404;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbLink href="/recruiter">Recruiter space</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbLink href={listHref}>Suggested candidates</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbCurrent>{name}</BreadcrumbCurrent>
          </Breadcrumb>
        }
        title={
          <span className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-border bg-blue-surface font-headline-sm text-headline-sm font-bold text-blue-deep"
            >
              {candidateInitials(name)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{name}</span>
              {position ? (
                <span className="mt-0.5 truncate text-body-sm font-body-sm font-semibold text-text-secondary">
                  {position}
                </span>
              ) : null}
            </span>
          </span>
        }
        subtitle={offer.data ? `Suggested for ${offer.data.title}` : "Suggested candidate"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {status === "applied" ? <Badge tone="success">Applied</Badge> : null}
            {status === "invited" ? <Badge tone="accent">Invited</Badge> : null}
            {data && status === "suggested" && data.canInvite ? (
              <CtaButton
                icon="send"
                busy={invite.isPending}
                onClick={() => setConfirming(true)}
                className="whitespace-nowrap"
              >
                Invite to apply
              </CtaButton>
            ) : null}
            <ButtonLink href={listHref} variant="outline-sm">
              Back to candidates
              <Icon name="arrow_back" className="text-[14px]" />
            </ButtonLink>
          </div>
        }
      />

      {profile.isLoading ? (
        <section className={SECTION_CARD_CLASS}>
          <div className="flex items-center gap-2 px-6 py-6 text-body-sm font-body-sm text-text-secondary">
            <Spinner />
            Loading profile…
          </div>
        </section>
      ) : null}

      {profile.isError ? (
        <Alert variant="error" title="Could not load this profile">
          <div className="flex items-center justify-between gap-3">
            <span>{withdrawn ? WITHDRAWN_MESSAGE : getApiErrorMessage(profile.error)}</span>
            {withdrawn ? null : (
              <Button variant="outline-sm" type="button" onClick={() => void profile.refetch()}>
                Retry
              </Button>
            )}
          </div>
        </Alert>
      ) : null}

      {invite.error ? (
        <Alert variant="error" title="Invitation failed">
          {getApiErrorMessage(invite.error)}
        </Alert>
      ) : null}

      {data ? (
        <ProfileSections
          profile={data.profile}
          account={readOnlyAccount(data)}
          readOnly
          contactUnavailable
        />
      ) : null}

      {confirming ? (
        <ConfirmDialog
          title="Invite this candidate to apply?"
          message="They will see the invitation in their applications. An invitation cannot be withdrawn."
          confirmLabel="Invite"
          icon="send"
          busy={invite.isPending}
          onConfirm={() =>
            invite.mutate(suggestionId, { onSettled: () => setConfirming(false) })
          }
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}
