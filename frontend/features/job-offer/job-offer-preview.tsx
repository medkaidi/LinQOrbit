"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import {
  ITEM_CARD_CLASS,
  MUTED_TEXT_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { PublicJobArticle } from "@/features/job-offer/public-job-article";
import {
  canRefreshOfferAnalysis,
  OFFER_TRANSITION_CONFIRM,
  OfferAnalysisBadge,
  QUESTION_TYPE_LABELS,
  STATUS_LABELS,
  toArticleModel,
  validateConfirmMessage,
} from "@/features/job-offer/job-offer-shared";
import { useReferenceDegrees, useReferenceStudyFields } from "@/hooks/use-candidate-profile";
import { useCompanies } from "@/hooks/use-companies";
import {
  useContractTypes,
  useEmploymentTypes,
  useJobOffer,
  useJobOfferTransition,
  useWorkModes,
} from "@/hooks/use-job-offers";
import { useOfferNormalizationStream } from "@/hooks/use-normalization-stream";
import { getApiErrorMessage } from "@/lib/utils/api-error";

function labelOf(options: { id: string; label: string }[] | undefined, id: string | null) {
  if (id === null) {
    return null;
  }
  return options?.find((option) => option.id === id)?.label ?? null;
}

/** Libellés des identifiants de référence connus, dans l'ordre de l'offre (inconnus omis). */
function labelsOf(options: { id: string; label: string }[] | undefined, ids: string[]) {
  const byId = new Map((options ?? []).map((option) => [option.id, option.label] as const));
  return ids
    .map((id) => byId.get(id))
    .filter((label): label is string => label != null);
}

/**
 * Prévisualisation d'une offre avant publication : le rendu exact de la fiche
 * publique, précédé d'un bandeau « pas encore publique ». Tous statuts
 * (lecture seule des données du membre).
 */
export function JobOfferPreview({ offerId }: { offerId: string }) {
  const router = useRouter();
  const offer = useJobOffer(offerId);
  const transition = useJobOfferTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const companies = useCompanies();
  const contractTypes = useContractTypes();
  const employmentTypes = useEmploymentTypes();
  const workModes = useWorkModes();
  const degrees = useReferenceDegrees();
  const studyFields = useReferenceStudyFields();
  // Un seul flux par offre, ouvert pendant l'analyse : chaque signal relit la
  // liste et le détail (GET = source de vérité), y compris une analyse déjà en
  // cours à l'ouverture de la page.
  useOfferNormalizationStream(offerId, Boolean(offer.data?.normalizationInProgress));

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
            <span>{offer.isError ? getApiErrorMessage(offer.error) : ""}</span>
            <Button variant="outline-sm" onClick={() => router.push("/recruiter")}>
              Back to offers
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  const data = offer.data;
  const refreshAction = data.status === "published" ? "revalidate" : "validate";
  const canRefresh =
    (data.status === "validated" || data.status === "published") &&
    canRefreshOfferAnalysis(data);
  // Même rendu que la fiche publique, libellés résolus côté membre (sans actions : l'offre n'est pas publique).
  const article = toArticleModel(data, {
    companyName: companies.data?.find((company) => company.id === data.companyId)?.name ?? null,
    contractType: labelOf(contractTypes.data, data.contractTypeId),
    employmentType: labelOf(employmentTypes.data, data.employmentTypeId),
    workMode: labelOf(workModes.data, data.workModeId),
    degreeLabels: labelsOf(degrees.data, data.degreeIds),
    studyFieldLabels: labelsOf(studyFields.data, data.studyFieldIds),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="pb-6 border-b border-slate-border flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body-sm font-body-sm text-text-secondary">
              {STATUS_LABELS[data.status]}
            </p>
            <OfferAnalysisBadge
              status={data.status}
              normalization={
                data.normalizationInProgress
                  ? "progress"
                  : data.normalizationFailed
                    ? "failed"
                    : null
              }
              analysisOutdated={data.analysisOutdated}
              unvalidatedChanges={data.hasUnvalidatedChanges}
            />
          </div>
          <h1 className="font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
            Offer preview
          </h1>
        </div>
        {canRefresh ? (
          <Button variant="outline-sm" onClick={() => setConfirmOpen(true)}>
            <Icon name="check_circle" className="text-[14px]" />
            Validate again
          </Button>
        ) : null}
      </div>
      {transition.error ? (
        <Alert variant="error" title="Could not refresh the analysis">
          {getApiErrorMessage(transition.error)}
        </Alert>
      ) : null}
      <Alert variant="info" title="Not public yet">
        This is how the offer will look once published.
      </Alert>
      {/* Article autonome (T-73) : pas de wrapper blanc, chaque bloc porte sa carte. */}
      <PublicJobArticle article={article} />
      {data.questions.length > 0 ? (
        <section className="bg-canvas-white rounded-2xl shadow-sm">
          <header className={SECTION_HEADER_CLASS}>
            <h2 className={SECTION_TITLE_CLASS}>Screening questions</h2>
          </header>
          <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
            <p className={MUTED_TEXT_CLASS}>
              Only your team sees these questions — candidates answer them when
              they apply.
            </p>
            <ol className="flex flex-col gap-3">
              {data.questions.map((question) => (
                <li key={question.id} className={ITEM_CARD_CLASS}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-body-md text-body-md text-text-primary font-semibold">
                      {question.label}
                    </span>
                    <span className={MUTED_TEXT_CLASS}>{QUESTION_TYPE_LABELS[question.type]}</span>
                    {question.isRequired ? <span className={MUTED_TEXT_CLASS}>Required</span> : null}
                  </div>
                  {question.options.length > 0 ? (
                    <p className={`${MUTED_TEXT_CLASS} mt-1`}>
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
      {confirmOpen ? (
        <ConfirmDialog
          title={OFFER_TRANSITION_CONFIRM[refreshAction].title}
          message={validateConfirmMessage(data, refreshAction)}
          confirmLabel={OFFER_TRANSITION_CONFIRM[refreshAction].confirmLabel}
          icon={OFFER_TRANSITION_CONFIRM[refreshAction].icon}
          busy={transition.isPending}
          onConfirm={() =>
            transition.mutate(
              { offerId: data.id, action: refreshAction },
              { onSettled: () => setConfirmOpen(false) },
            )
          }
          onCancel={() => setConfirmOpen(false)}
        />
      ) : null}
    </div>
  );
}
