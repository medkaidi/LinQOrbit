"use client";

import { useState } from "react";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader,
} from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { NavPill } from "@/components/ui/nav-pill";
import {
  ITEM_CARD_CLASS,
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import {
  ApplicationStatusPill,
  answerValueLabel,
  appliedOnLabel,
} from "@/features/application/application-shared";
import { ApplicationSteps } from "@/features/application/application-steps";
import { OfferBanner } from "@/features/application/offer-banner";
import { RecruiterQuestionsStep } from "@/features/application/recruiter-questions-step";
import { SubmitPanel } from "@/features/application/submit-panel";
import { PublicJobLoading, PublicJobNotFound } from "@/features/job-offer/public-job-states";
import { parsePublicId } from "@/features/job-offer/job-offer-shared";
import { MatchingPanel } from "@/features/matching/matching-panel";
import { useApplicationContext } from "@/hooks/use-applications";
import type { ApplicationContext, ApplicationSummary } from "@/types/application";

function Header({ jobParam, context }: { jobParam: string; context: ApplicationContext }) {
  return (
    <PageHeader
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbLink href={`/jobs/${jobParam}`}>Job offer</BreadcrumbLink>
          <BreadcrumbSeparator />
          <BreadcrumbCurrent>Apply</BreadcrumbCurrent>
        </Breadcrumb>
      }
      title={context.job.title}
      subtitle={context.job.companyName}
    />
  );
}

function AlreadyApplied({ application }: { application: ApplicationSummary }) {
  const appliedOn = appliedOnLabel(application.createdAt);
  return (
    <section className={SECTION_CARD_CLASS}>
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Your application</h2>
        <ApplicationStatusPill status={application.status} />
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col items-start gap-4">
        <p className="text-body-md font-body-md text-text-primary">
          You have already applied to this job offer
          {appliedOn ? ` on ${appliedOn}` : ""}. A single application per offer is allowed, even
          after a withdrawal.
        </p>
        <NavPill href="/applications" icon="work_history" label="View my applications" />
      </div>
    </section>
  );
}

/** Rappel des réponses enregistrées, avec retour à l'étape des questions. */
function AnswersRecap({ context, onEdit }: { context: ApplicationContext; onEdit: () => void }) {
  return (
    <section className={SECTION_CARD_CLASS} aria-label="Your answers">
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Your answers</h2>
        <Button variant="outline-sm" type="button" onClick={onEdit}>
          Edit answers
        </Button>
      </header>
      <div className="px-6 pt-5 pb-6">
        {context.answers.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {context.answers.map((answer) => (
              <li key={answer.questionId} className={ITEM_CARD_CLASS}>
                <p className={MUTED_TEXT_CLASS}>{answer.label}</p>
                <p className="mt-1 text-body-md font-body-md text-text-primary break-words">
                  {answerValueLabel(answer)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={MUTED_TEXT_CLASS}>No answer is needed for this offer.</p>
        )}
      </div>
    </section>
  );
}

function ApplicationJourney({ publicId, jobParam }: { publicId: string; jobParam: string }) {
  const context = useApplicationContext(publicId);
  // Retour volontaire à l'étape des questions depuis l'étape matching (état d'affichage seul).
  const [editingAnswers, setEditingAnswers] = useState(false);

  if (context.isLoading) {
    return <PublicJobLoading />;
  }
  if (context.isError || !context.data) {
    return <PublicJobNotFound />;
  }

  const data = context.data;
  const draft = data.existingApplication?.status === "draft" ? data.existingApplication : null;
  const showQuestions = data.step === "recruiter_questions" || editingAnswers;

  return (
    <div className="w-full flex flex-col gap-6">
      <Header jobParam={jobParam} context={data} />
      <OfferBanner publicId={publicId} />
      <ApplicationSteps step={data.step} />

      {data.step === "submitted" && data.existingApplication ? (
        <AlreadyApplied application={data.existingApplication} />
      ) : null}

      {data.step !== "submitted" && showQuestions ? (
        <RecruiterQuestionsStep context={data} onContinue={() => setEditingAnswers(false)} />
      ) : null}

      {data.step === "matching" && !editingAnswers && draft ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col gap-6">
            <SubmitPanel context={data} applicationId={draft.id} />
            <AnswersRecap context={data} onEdit={() => setEditingAnswers(true)} />
          </div>
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <MatchingPanel publicId={publicId} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Parcours de candidature `/jobs/[job]/apply` (D59) : bandeau de l'offre (+
 * rideau du détail), indicateur d'étapes piloté par l'étape **calculée par le
 * serveur**, questions du recruteur enregistrées en brouillon, puis matching
 * facultatif et transmission ; une candidature transmise bascule sur l'état
 * « déjà candidaté ». Le paramètre `jobParam` mélange publicId (12 car.) et
 * slug cosmétique.
 */
export function ApplyView({ jobParam }: { jobParam: string }) {
  const publicId = parsePublicId(jobParam);
  if (publicId == null) {
    return <PublicJobNotFound />;
  }
  return <ApplicationJourney publicId={publicId} jobParam={jobParam} />;
}
