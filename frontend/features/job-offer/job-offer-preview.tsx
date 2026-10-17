"use client";

import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  PublicJobArticle,
  type PublicJobArticleModel,
} from "@/features/job-offer/public-job-article";
import {
  OFFER_ITEM_CARD,
  OFFER_MUTED,
  OFFER_SECTION_HEADER,
  OFFER_SECTION_TITLE,
  QUESTION_TYPE_LABELS,
  locationLabel,
  salaryLabel,
  SENIORITY_LABELS,
  STATUS_LABELS,
} from "@/features/job-offer/job-offer-shared";
import { useReferenceDegrees, useReferenceStudyFields } from "@/hooks/use-candidate-profile";
import { useCompanies } from "@/hooks/use-companies";
import {
  useContractTypes,
  useEmploymentTypes,
  useJobOffer,
  useWorkModes,
} from "@/hooks/use-job-offers";
import { getJobOfferErrorMessage } from "@/lib/api/job-offer.api";
import type { JobOffer } from "@/types/recruiter";

function labelOf(options: { id: string; label: string }[] | undefined, id: string | null) {
  if (id === null) {
    return null;
  }
  return options?.find((option) => option.id === id)?.label ?? null;
}

/** Même rendu que la fiche publique, labels résolus côté membre. */
function toArticle(
  offer: JobOffer,
  companyName: string | null,
  contractType: string | null,
  employmentType: string | null,
  workMode: string | null,
  degreeLabels: Map<string, string>,
  studyFieldLabels: Map<string, string>,
): PublicJobArticleModel {
  const seniority = offer.seniority ? SENIORITY_LABELS[offer.seniority] : null;
  return {
    companyName,
    title: offer.title,
    meta: [
      seniority,
      locationLabel(offer.city, offer.country),
      contractType,
      employmentType,
      workMode,
      salaryLabel(offer.salaryMin, offer.salaryMax, offer.salaryCurrency, offer.salaryPeriod),
    ].filter((part): part is string => Boolean(part)),
    description: offer.description,
    skills: offer.skills.map((skill) => ({
      id: skill.skillId,
      name: skill.name,
      requirementType: skill.requirementType,
    })),
    languages: offer.languages.map((language) => ({
      id: language.languageId,
      name: language.name,
      level: language.level,
    })),
    degreeLabels: offer.degreeIds
      .map((id) => degreeLabels.get(id))
      .filter((label): label is string => label != null),
    studyFieldLabels: offer.studyFieldIds
      .map((id) => studyFieldLabels.get(id))
      .filter((label): label is string => label != null),
  };
}

/**
 * Prévisualisation d'une offre avant publication : le rendu exact de la fiche
 * publique, précédé d'un bandeau « pas encore publique ». Tous statuts
 * (lecture seule des données du membre).
 */
export function JobOfferPreview({ offerId }: { offerId: string }) {
  const router = useRouter();
  const offer = useJobOffer(offerId);
  const companies = useCompanies();
  const contractTypes = useContractTypes();
  const employmentTypes = useEmploymentTypes();
  const workModes = useWorkModes();
  const degrees = useReferenceDegrees();
  const studyFields = useReferenceStudyFields();

  if (offer.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="pb-6 border-b border-slate-border">
          <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
            Offer preview
          </h1>
        </div>
        <div className="flex items-center gap-2 text-body-sm text-text-secondary">
          <Spinner />
          Loading…
        </div>
      </div>
    );
  }

  if (offer.isError || !offer.data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="pb-6 border-b border-slate-border">
          <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
            Offer preview
          </h1>
        </div>
        <Alert variant="error" title="Could not load the offer">
          <div className="flex items-center justify-between gap-3">
            <span>{offer.isError ? getJobOfferErrorMessage(offer.error) : ""}</span>
            <Button variant="outline-sm" onClick={() => router.push("/recruiter")}>
              Back to offers
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  const data = offer.data;
  const article = toArticle(
    data,
    companies.data?.find((company) => company.id === data.companyId)?.name ?? null,
    labelOf(contractTypes.data, data.contractTypeId),
    labelOf(employmentTypes.data, data.employmentTypeId),
    labelOf(workModes.data, data.workModeId),
    new Map((degrees.data ?? []).map((degree) => [degree.id, degree.label] as const)),
    new Map((studyFields.data ?? []).map((field) => [field.id, field.label] as const)),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="pb-6 border-b border-slate-border">
        <p className="text-body-sm font-body-sm text-text-secondary">
          {STATUS_LABELS[data.status]}
        </p>
        <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
          Offer preview
        </h1>
      </div>
      <Alert variant="info" title="Not public yet">
        This is how the offer will look once published.
      </Alert>
      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <PublicJobArticle article={article} />
      </section>
      {data.questions.length > 0 ? (
        <section className="bg-canvas-white rounded-2xl shadow-sm">
          <header className={OFFER_SECTION_HEADER}>
            <h2 className={OFFER_SECTION_TITLE}>Screening questions</h2>
          </header>
          <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
            <p className={OFFER_MUTED}>
              Only your team sees these questions — candidates answer them when
              they apply.
            </p>
            <ol className="flex flex-col gap-3">
              {data.questions.map((question) => (
                <li key={question.id} className={OFFER_ITEM_CARD}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-body-md text-body-md text-text-primary font-semibold">
                      {question.label}
                    </span>
                    <span className={OFFER_MUTED}>{QUESTION_TYPE_LABELS[question.type]}</span>
                    {question.isRequired ? <span className={OFFER_MUTED}>Required</span> : null}
                  </div>
                  {question.options.length > 0 ? (
                    <p className={`${OFFER_MUTED} mt-1`}>
                      {question.options
                        .map((option) => (option.preferred ? `${option.label} (preferred)` : option.label))
                        .join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
    </div>
  );
}
