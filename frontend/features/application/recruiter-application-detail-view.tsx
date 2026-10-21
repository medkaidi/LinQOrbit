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
import { Badge } from "@/components/ui/badge";
import { Button, CtaButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
  ITEM_CARD_CLASS,
} from "@/components/ui/section";
import { ApplicationStatusPill } from "@/features/application/application-shared";
import {
  RECRUITER_SECTION_LABELS,
  recruiterAnswerValue,
  recruiterCandidateName,
  submittedOnLabel,
} from "@/features/application/recruiter-application-shared";
import {
  useDecideRecruiterApplication,
  useDownloadRecruiterApplicationCv,
  useRecruiterApplication,
} from "@/hooks/use-recruiter-applications";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { cn } from "@/lib/utils/cn";
import type {
  RecruiterAnswerView,
  RecruiterApplicationDecision,
  RecruiterAssessmentSectionView,
  RecruiterClarificationStatusValue,
  RecruiterContestationView,
} from "@/types/application";

const CLARIFICATION_STATUS_LABELS: Record<RecruiterClarificationStatusValue, string> = {
  open: "Open",
  answered: "Answered",
  skipped: "Skipped",
};

function gapLabel(gap: number): string {
  return Number.isInteger(gap) ? String(gap) : gap.toFixed(1);
}

function SectionHeader({ title, aside }: { title: string; aside?: string }) {
  return (
    <header className={SECTION_HEADER_CLASS}>
      <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
      {aside ? <span className={MUTED_TEXT_CLASS}>{aside}</span> : null}
    </header>
  );
}

function RecruiterAnswer({ answer }: { answer: RecruiterAnswerView }) {
  const value = recruiterAnswerValue(answer);
  const hasOptions = answer.options.length > 0;
  return (
    <li className={ITEM_CARD_CLASS}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-label-md text-label-md text-text-primary font-bold">{answer.label}</h3>
        <Badge tone={answer.required ? "accent" : "outline"}>
          {answer.required ? "Required" : "Optional"}
        </Badge>
      </div>
      {hasOptions ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {answer.options.map((option) => (
            <li
              key={option.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-border bg-item-surface/50 px-3 py-1 font-body-sm text-body-sm text-text-primary"
            >
              <span>{option.label}</span>
              {option.preferred ? <Badge tone="outline">Preferred</Badge> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-body-md font-body-md text-text-primary whitespace-pre-wrap break-words">
          {value}
        </p>
      )}
    </li>
  );
}

function AssessmentSection({
  section,
  index,
}: {
  section: RecruiterAssessmentSectionView;
  index: number;
}) {
  return (
    <section className={cn(index > 0 && "border-t border-slate-border pt-5", "flex flex-col gap-3")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-headline-sm text-headline-sm text-text-primary font-semibold">
          {RECRUITER_SECTION_LABELS[section.section]}
        </h3>
        <span className="font-label-md text-label-md text-text-primary tabular-nums">
          {section.score === null ? "Not evaluated" : Math.round(section.score)}
        </span>
      </div>
      {section.criteria.length === 0 ? (
        <p className={MUTED_TEXT_CLASS}>No criteria in this section.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {section.criteria.map((criterion) => (
            <li key={criterion.key} className={ITEM_CARD_CLASS}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-text-primary font-bold">
                    {criterion.label}
                  </p>
                  {criterion.requirement ? (
                    <p className={MUTED_TEXT_CLASS}>{criterion.requirement}</p>
                  ) : null}
                </div>
                <span className="font-label-md text-label-md text-blue-deep tabular-nums font-bold">
                  {criterion.score}
                </span>
              </div>
              <p className="mt-2 text-body-sm font-body-sm text-text-secondary whitespace-pre-wrap break-words">
                {criterion.rationale.trim() ? criterion.rationale : "No AI rationale."}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Contest({ contest }: { contest: RecruiterContestationView }) {
  return (
    <li className={ITEM_CARD_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-label-md text-label-md text-text-primary font-bold">{contest.label}</h3>
        <span className="font-body-sm text-body-sm text-text-secondary tabular-nums">
          AI {contest.aiScore} · Candidate {contest.selfValue} · Gap {gapLabel(contest.gap)}
        </span>
      </div>
      {contest.comment ? (
        <p className="mt-2 text-body-sm font-body-sm text-text-secondary whitespace-pre-wrap break-words">
          {contest.comment}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Détail recruteur d'une candidature (T-66, D65) : réponses avec `preferred`,
 * évaluation épinglée par critère (justification IA), clarifications, contestations
 * et CV. Les décisions sont manuelles, terminales et confirmées ; aucun recalcul IA.
 */
export function RecruiterApplicationDetailView({
  offerId,
  applicationId,
}: {
  offerId: string;
  applicationId: string;
}) {
  const application = useRecruiterApplication(offerId, applicationId);
  const download = useDownloadRecruiterApplicationCv(offerId, applicationId);
  const decide = useDecideRecruiterApplication(offerId, applicationId);
  const [pendingDecision, setPendingDecision] = useState<RecruiterApplicationDecision | null>(null);

  const data = application.data;
  const name = data ? recruiterCandidateName(data.candidate) : "Application";
  const submittedOn = data ? submittedOnLabel(data.submittedAt) : null;
  const errorMessage = application.isError ? getApiErrorMessage(application.error) : null;
  const decideError = decide.error ? getApiErrorMessage(decide.error) : null;

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
            <BreadcrumbCurrent>{name}</BreadcrumbCurrent>
          </Breadcrumb>
        }
        title={name}
        subtitle={
          data
            ? `Application for ${data.job.title}${data.job.companyName ? ` · ${data.job.companyName}` : ""}`
            : "Application detail"
        }
        action={
          data?.canDecide ? (
            <div className="flex flex-wrap gap-2">
              <div className="w-36">
                <CtaButton
                  icon="check_circle"
                  busy={decide.isPending && pendingDecision === "accepted"}
                  onClick={() => setPendingDecision("accepted")}
                >
                  Accept
                </CtaButton>
              </div>
              <div className="w-36">
                <CtaButton
                  icon="cancel"
                  tone="danger"
                  busy={decide.isPending && pendingDecision === "rejected"}
                  onClick={() => setPendingDecision("rejected")}
                >
                  Reject
                </CtaButton>
              </div>
            </div>
          ) : undefined
        }
      />

      {application.isLoading ? (
        <section className={SECTION_CARD_CLASS}>
          <div className="px-6 py-6 flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
            <Spinner />
            Loading application…
          </div>
        </section>
      ) : null}

      {application.isError ? (
        <section className={SECTION_CARD_CLASS}>
          <div className="px-6 py-6">
            <Alert variant="error" title="Could not load this application">
              <div className="flex items-center justify-between gap-3">
                <span>{errorMessage}</span>
                <Button variant="outline-sm" onClick={() => void application.refetch()}>
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        </section>
      ) : null}

      {decideError ? (
        <Alert variant="error" title="Decision failed">
          {decideError}
        </Alert>
      ) : null}

      {download.error ? (
        <Alert variant="error" title="CV download failed">
          {getApiErrorMessage(download.error)}
        </Alert>
      ) : null}

      {data ? (
        <>
          <section className={SECTION_CARD_CLASS}>
            <SectionHeader title="Application" aside="Pinned to submission" />
            <div className="px-6 pt-5 pb-6 flex flex-wrap items-start justify-between gap-4">
              <dl className="flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <dt className={MUTED_TEXT_CLASS}>Candidate</dt>
                  <dd className="text-body-md font-body-md text-text-primary font-semibold">{name}</dd>
                </div>
                <div>
                  <dt className={MUTED_TEXT_CLASS}>Submitted</dt>
                  <dd className="text-body-md font-body-md text-text-primary">
                    {submittedOn ?? "Unknown date"}
                  </dd>
                </div>
                <div>
                  <dt className={MUTED_TEXT_CLASS}>Status</dt>
                  <dd className="mt-1">
                    <ApplicationStatusPill status={data.status} />
                  </dd>
                </div>
                <div>
                  <dt className={MUTED_TEXT_CLASS}>CV</dt>
                  <dd className="text-body-md font-body-md text-text-primary">
                    {data.cv?.originalName ?? "No CV pinned"}
                  </dd>
                </div>
              </dl>
              <Button
                variant="outline-sm"
                busy={download.isPending}
                disabled={!data.cv}
                onClick={() =>
                  data.cv
                    ? download.mutate(data.cv.originalName)
                    : undefined
                }
              >
                Download CV
              </Button>
            </div>
          </section>

          <section className={SECTION_CARD_CLASS}>
            <SectionHeader
              title="Recruiter questions"
              aside={data.answers.length === 1 ? "1 answer" : `${data.answers.length} answers`}
            />
            <div className="px-6 pt-5 pb-6">
              {data.answers.length === 0 ? (
                <p className={MUTED_TEXT_CLASS}>No recruiter questions were answered.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.answers.map((answer) => (
                    <RecruiterAnswer key={answer.questionId} answer={answer} />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className={SECTION_CARD_CLASS}>
            <SectionHeader
              title="AI assessment"
              aside={data.assessment.available ? "Pinned matching result" : undefined}
            />
            <div className="px-6 pt-5 pb-6 flex flex-col gap-5">
              {!data.assessment.available ? (
                <p className={MUTED_TEXT_CLASS}>No AI assessment was attached to this application.</p>
              ) : data.assessment.sections.length === 0 ? (
                <p className={MUTED_TEXT_CLASS}>No section was evaluated.</p>
              ) : (
                data.assessment.sections.map((section, index) => (
                  <AssessmentSection key={section.section} section={section} index={index} />
                ))
              )}
            </div>
          </section>

          <section className={SECTION_CARD_CLASS}>
            <SectionHeader
              title="AI clarifications"
              aside={
                data.clarifications.length === 1
                  ? "1 exchange"
                  : `${data.clarifications.length} exchanges`
              }
            />
            <div className="px-6 pt-5 pb-6">
              {data.clarifications.length === 0 ? (
                <p className={MUTED_TEXT_CLASS}>No AI clarification exchange.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.clarifications.map((clarification) => (
                    <li key={clarification.id} className={ITEM_CARD_CLASS}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-label-md text-label-md text-text-primary font-bold">
                          {clarification.question}
                        </h3>
                        <Badge tone="outline">
                          {CLARIFICATION_STATUS_LABELS[clarification.status]}
                        </Badge>
                      </div>
                      {clarification.rationale ? (
                        <p className={cn(MUTED_TEXT_CLASS, "mt-1")}>{clarification.rationale}</p>
                      ) : null}
                      <p className="mt-2 text-body-md font-body-md text-text-primary whitespace-pre-wrap break-words">
                        {clarification.answer?.trim() || "No answer yet."}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className={SECTION_CARD_CLASS}>
            <SectionHeader
              title="Contests"
              aside={
                data.contests.length === 1
                  ? "1 contested criterion"
                  : `${data.contests.length} contested criteria`
              }
            />
            <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
              <p className={MUTED_TEXT_CLASS}>
                Signals of disagreement between the candidate and the AI, not a quality score.
              </p>
              {data.contests.length === 0 ? (
                <p className={MUTED_TEXT_CLASS}>No criterion was contested by the candidate.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.contests.map((contest) => (
                    <Contest key={contest.criterionKey} contest={contest} />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      ) : null}

      {pendingDecision ? (
        <ConfirmDialog
          title={
            pendingDecision === "accepted"
              ? "Accept this application?"
              : "Reject this application?"
          }
          message="This decision is final and will not recalculate the AI assessment."
          confirmLabel={pendingDecision === "accepted" ? "Accept application" : "Reject application"}
          tone={pendingDecision === "rejected" ? "danger" : "primary"}
          icon={pendingDecision === "accepted" ? "check_circle" : "cancel"}
          busy={decide.isPending}
          onConfirm={() => {
            const decision = pendingDecision;
            decide.mutate(decision, {
              onSuccess: () => setPendingDecision(null),
              onError: () => setPendingDecision(null),
            });
          }}
          onCancel={() => setPendingDecision(null)}
        />
      ) : null}
    </div>
  );
}
