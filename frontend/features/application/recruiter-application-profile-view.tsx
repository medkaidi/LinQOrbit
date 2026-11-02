"use client";

import { isAxiosError } from "axios";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader,
} from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SECTION_CARD_CLASS } from "@/components/ui/section";
import { Spinner } from "@/components/ui/spinner";
import {
  candidateInitials,
  recruiterCandidateName,
  RecruiterContactCard,
} from "@/features/application/recruiter-application-shared";
import { ProfileSections } from "@/features/candidate/profile-view";
import { useRecruiterApplicationProfile } from "@/hooks/use-recruiter-applications";
import { useJobOffer } from "@/hooks/use-job-offers";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { AuthUser } from "@/types/auth";
import type { RecruiterCandidateProfile } from "@/types/application";

const NOT_FOUND_MESSAGE =
  "This candidate profile is no longer available for this application.";

/**
 * Compte « de lecture » passé à la section About : nom et localisation du
 * candidat, **avec ses coordonnées** (T-125, D107) — il a candidaté à cette
 * offre, le recruteur doit pouvoir le joindre.
 */
function readOnlyAccount(data: RecruiterCandidateProfile): AuthUser {
  return {
    id: "",
    email: data.email ?? "",
    firstName: data.candidate?.firstName ?? "",
    lastName: data.candidate?.lastName ?? "",
    sex: null,
    phone: data.phone,
    homeCountry: null,
    currentCity: data.currentCity,
    currentCountry: data.currentCountry,
    roles: [],
  };
}

/**
 * Profil complet du candidat d'une candidature (T-125, D107) : mêmes sections
 * que sa propre vue (lecture seule), **avec ses coordonnées** — le candidat a
 * postulé à cette offre, son CV et son profil sont donc connus du recruteur.
 * Le consentement de visibilité (T-102, D86) ne s'applique pas ici : il
 * gouverne la surface « candidat suggéré » (découverte après publication).
 */
export function RecruiterApplicationProfileView({
  offerId,
  applicationId,
}: {
  offerId: string;
  applicationId: string;
}) {
  const offer = useJobOffer(offerId);
  const profile = useRecruiterApplicationProfile(offerId, applicationId);

  const data = profile.data;
  const name = data ? recruiterCandidateName(data.candidate) : "Candidate";
  const position =
    data?.candidate?.title?.trim() || data?.profile.about.title?.trim() || null;
  const applicationHref = `/recruiter/offers/${offerId}/applications/${applicationId}`;
  const notFound = isAxiosError(profile.error) && profile.error.response?.status === 404;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbLink href="/recruiter">Recruiter space</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbLink href={`/recruiter/offers/${offerId}/applications`}>
              Applications
            </BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbLink href={applicationHref}>{name}</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbCurrent>Profile</BreadcrumbCurrent>
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
        subtitle={
          offer.data
            ? `Candidate profile · application for ${offer.data.title}`
            : "Candidate profile"
        }
        action={
          <ButtonLink href={applicationHref} variant="outline-sm">
            Back to application
            <Icon name="arrow_back" className="text-[14px]" />
          </ButtonLink>
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
        <Alert variant="error" title="Could not load this candidate profile">
          <div className="flex items-center justify-between gap-3">
            <span>{notFound ? NOT_FOUND_MESSAGE : getApiErrorMessage(profile.error)}</span>
            {notFound ? null : (
              <Button variant="outline-sm" type="button" onClick={() => void profile.refetch()}>
                Retry
              </Button>
            )}
          </div>
        </Alert>
      ) : null}

      {data ? (
        <>
          <RecruiterContactCard email={data.email} phone={data.phone} />
          <ProfileSections profile={data.profile} account={readOnlyAccount(data)} readOnly />
        </>
      ) : null}
    </div>
  );
}
