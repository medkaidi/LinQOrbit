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
import { Button, ButtonLink, CtaButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  ITEM_CARD_CLASS,
} from "@/components/ui/section";
import { ApplicationStatusPill } from "@/features/application/application-shared";
import { AssessmentCard } from "@/features/application/recruiter-assessment-card";
import { CriterionReportDialog } from "@/features/application/criterion-report-dialog";
import {
  candidateInitials,
  contestCountLabel,
  ContestGapBlock,
  gapLabel,
  recruiterAnswerValue,
  recruiterCandidateName,
  SCORE_UNIT_CLASSES,
  SectionHeader,
  submittedOnLabel,
} from "@/features/application/recruiter-application-shared";
import {
  useDecideRecruiterApplication,
  useDownloadRecruiterApplicationCv,
  useRecruiterApplication,
  useReportCriterion,
} from "@/hooks/use-recruiter-applications";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { formatFileSize } from "@/lib/utils/format";
import type {
  RecruiterAnswerView,
  RecruiterApplicationDecision,
  RecruiterApplicationDetail,
  RecruiterClarificationStatusValue,
  RecruiterClarificationView,
  RecruiterContestationView,
  RecruiterCriterionView,
  RecruiterCvSummary,
} from "@/types/application";

const CLARIFICATION_STATUS_LABELS: Record<RecruiterClarificationStatusValue, string> = {
  open: "Open",
  answered: "Answered",
  skipped: "Skipped",
};

/**
 * Pourquoi les boutons de décision sont absents — deux cas distincts, jamais
 * un silence : la candidature est déjà décidée, ou le recruteur n'a pas le
 * droit (D12, `canDecide` calculé par le serveur).
 */
function readOnlyMessage(detail: RecruiterApplicationDetail): string {
  if (detail.status === "accepted" || detail.status === "rejected") {
    return `This application was already ${detail.status} — the decision is final and the AI assessment was not recalculated.`;
  }
  return "Only the owner of this company or the recruiter who created this offer can accept or reject this application.";
}

/** Barre de décision collante : statut, date et décision terminale. */
function DecisionBar({
  detail,
  busyDecision,
  onDecide,
}: {
  detail: RecruiterApplicationDetail;
  busyDecision: RecruiterApplicationDecision | null;
  onDecide: (decision: RecruiterApplicationDecision) => void;
}) {
  const submittedOn = submittedOnLabel(detail.submittedAt);
  return (
    <div className="sticky top-16 z-30 mt-px flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-border bg-canvas-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <ApplicationStatusPill status={detail.status} />
        <span className="text-body-sm font-body-sm text-text-secondary">
          {submittedOn ? `Applied ${submittedOn}` : "Submission date unavailable"}
        </span>
      </div>
      {detail.canDecide ? (
        <div className="flex flex-wrap items-center gap-2">
          <CtaButton
            icon="check_circle"
            busy={busyDecision === "accepted"}
            onClick={() => onDecide("accepted")}
          >
            Accept
          </CtaButton>
          <CtaButton
            icon="cancel"
            tone="danger"
            busy={busyDecision === "rejected"}
            onClick={() => onDecide("rejected")}
          >
            Reject
          </CtaButton>
        </div>
      ) : (
        <p className="text-body-sm font-body-sm text-text-tertiary">{readOnlyMessage(detail)}</p>
      )}
    </div>
  );
}

/**
 * CV épinglé à la transmission : document de la candidature, téléchargement
 * streamé. L'action est un CTA **bleu** (secondaire) : l'orange reste réservé
 * à la décision terminale (Accept / Reject).
 */
function CvCard({
  cv,
  busy,
  onDownload,
}: {
  cv: RecruiterCvSummary | null;
  busy: boolean;
  onDownload: () => void;
}) {
  return (
    <section className={SECTION_CARD_CLASS} aria-label="CV">
      <SectionHeader
        title="CV"
        icon="description"
        aside={cv && cv.sizeBytes !== null ? formatFileSize(cv.sizeBytes) : undefined}
      />
      <div className="px-5 pt-4 pb-5 flex flex-col items-start gap-3">
        <p className="text-body-md font-body-md font-semibold text-text-primary break-words">
          {cv ? cv.originalName : "No CV pinned"}
        </p>
        <CtaButton
          icon="download"
          tone="secondary"
          busy={busy}
          disabled={!cv}
          onClick={onDownload}
        >
          Download CV
        </CtaButton>
      </div>
    </section>
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


/**
 * Contestation d'un critère : note IA, note du candidat, écart et argumentaire.
 * Aucune bande de lecture sur ces valeurs : la note propre du candidat n'est
 * pas un score de qualité, l'écart est un signal de désaccord.
 */
function Contest({ contest }: { contest: RecruiterContestationView }) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-slate-border bg-canvas-white/80 p-3">
      <p className="font-label-md text-label-md text-text-primary font-bold">{contest.label}</p>
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-border bg-item-surface/60 p-2 text-center">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
            AI
          </span>
          <span className="text-body-md font-body-md font-bold text-text-secondary tabular-nums">
            {contest.aiScore}
            <span className={SCORE_UNIT_CLASSES.md}>%</span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5 border-x border-slate-border">
          <span className="text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
            Candidate
          </span>
          <span className="text-body-md font-body-md font-bold text-text-primary tabular-nums">
            {contest.selfValue}
            <span className={SCORE_UNIT_CLASSES.md}>%</span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
            Gap
          </span>
          <span className="text-body-md font-body-md font-bold text-orange-deep tabular-nums">
            {gapLabel(contest.gap)} pts
          </span>
        </div>
      </div>
      {contest.comment ? (
        <div className="flex flex-col gap-1">
          <span className="font-label-md text-label-md text-text-secondary">
            Candidate&apos;s argument
          </span>
          <blockquote className="text-body-sm font-body-sm text-text-secondary italic whitespace-pre-wrap break-words">
            {contest.comment}
          </blockquote>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Panneau des contestations : orange quand le candidat conteste, gris sinon
 * (même code couleur que la carte de liste). Masqué sans évaluation IA.
 */
function ContestsCard({
  contests,
  averageGap,
}: {
  contests: RecruiterContestationView[];
  averageGap: number | null;
}) {
  const contested = contests.length > 0;
  return (
    <section className={SECTION_CARD_CLASS} aria-label="Contests">
      <SectionHeader title="Contests" icon="compare_arrows" aside={contestCountLabel(contests.length)} />
      <div className="px-5 pt-4 pb-5">
        {contested ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-orange-border/70 bg-orange-subtle/60 p-3">
            <ContestGapBlock averageGap={averageGap} size="md" />
            <p className="flex items-start gap-1.5 text-body-sm font-body-sm font-semibold leading-snug text-orange-deep">
              <Icon name="info" className="mt-px text-[14px]" />
              Disagreement signal, not a quality score
            </p>
            <ul className="flex flex-col gap-3">
              {contests.map((contest) => (
                <Contest key={contest.criterionKey} contest={contest} />
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-border bg-item-surface/60 p-4 text-center">
            <Icon name="check_circle" className="text-[18px] text-text-tertiary" />
            <span className="text-body-sm font-body-sm text-text-secondary">
              All scores uncontested
            </span>
          </div>
        )}
      </div>
    </section>
  );
}


function RecruiterQuestionsCard({ answers }: { answers: RecruiterAnswerView[] }) {
  return (
    <section className={SECTION_CARD_CLASS} aria-label="Recruiter questions">
      <SectionHeader
        title="Recruiter questions"
        icon="chat_bubble"
        aside={answers.length === 1 ? "1 answer" : `${answers.length} answers`}
      />
      <div className="px-5 pt-4 pb-5">
        {answers.length === 0 ? (
          <p className={MUTED_TEXT_CLASS}>No recruiter questions were answered.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {answers.map((answer) => (
              <RecruiterAnswer key={answer.questionId} answer={answer} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ClarificationsCard({ clarifications }: { clarifications: RecruiterClarificationView[] }) {
  return (
    <section className={SECTION_CARD_CLASS} aria-label="AI clarifications">
      <SectionHeader
        title="AI clarifications"
        icon="lightbulb"
        aside={clarifications.length === 1 ? "1 exchange" : `${clarifications.length} exchanges`}
      />
      <div className="px-5 pt-4 pb-5">
        {clarifications.length === 0 ? (
          <p className={MUTED_TEXT_CLASS}>No AI clarification exchange.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {clarifications.map((clarification) => (
              <li key={clarification.id} className={ITEM_CARD_CLASS}>
                <h3 className="font-label-md text-label-md text-text-primary font-bold min-w-0 break-words">
                  {clarification.question}
                </h3>
                {clarification.rationale ? (
                  <div className="mt-2 rounded-lg border border-blue-border bg-blue-surface/60 px-5 py-4">
                    <span className="flex items-center gap-1.5 font-label-md text-label-md font-bold text-blue-deep">
                      <Icon name="help_outline" className="text-[14px]" />
                      Why the AI asked this
                    </span>
                    <p className="mt-1 text-body-sm font-body-sm text-text-secondary whitespace-pre-wrap break-words">
                      {clarification.rationale}
                    </p>
                  </div>
                ) : null}
                {/* La mention d'état décrit la réponse : elle vit à côté du libellé
                    « Answer », plus à côté de la question. */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-border pt-3">
                  <span className="font-label-md text-label-md text-text-secondary">Answer</span>
                  <Badge tone="outline">
                    {CLARIFICATION_STATUS_LABELS[clarification.status]}
                  </Badge>
                </div>
                <p className="mt-2 text-body-md font-body-md text-text-primary whitespace-pre-wrap break-words">
                  {clarification.answer?.trim() || "No answer yet."}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * Détail recruteur d'une candidature (T-66, D65) : identité et CV épinglé,
 * barre de décision collante, évaluation IA par critère, réponses recruteur,
 * clarifications et contestations. Les décisions sont manuelles, terminales et
 * confirmées ; aucun recalcul IA, aucune note globale.
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
  const report = useReportCriterion(offerId, applicationId);
  const [pendingDecision, setPendingDecision] = useState<RecruiterApplicationDecision | null>(null);
  const [reportingCriterion, setReportingCriterion] = useState<RecruiterCriterionView | null>(null);

  const data = application.data;
  const name = data ? recruiterCandidateName(data.candidate) : "Application";
  const candidateTitle = data?.candidate?.title?.trim() || null;
  const errorMessage = application.isError ? getApiErrorMessage(application.error) : null;
  const decideError = decide.error ? getApiErrorMessage(decide.error) : null;
  const reportError = report.error ? getApiErrorMessage(report.error) : null;
  const contestedKeys = new Set((data?.contests ?? []).map((contest) => contest.criterionKey));
  const reportsByKey = new Map(
    (data?.criterionReports ?? []).map((item) => [item.criterionKey, item] as const),
  );

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
        title={
          // Monogramme + [nom / poste actuel] : le bloc de texte est aligné sur
          // le conteneur des initiales (motif avatar + identité).
          <span className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-border bg-blue-surface font-headline-sm text-headline-sm font-bold text-blue-deep"
            >
              {candidateInitials(name)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{name}</span>{" "}
              {candidateTitle ? (
                <span className="mt-0.5 truncate text-body-sm font-body-sm font-semibold text-text-secondary">
                  {candidateTitle}
                </span>
              ) : null}
            </span>
          </span>
        }
        subtitle={
          data
            ? `Application for ${data.job.title}${data.job.companyName ? ` · ${data.job.companyName}` : ""}`
            : "Application detail"
        }
        action={
          <ButtonLink href={`/recruiter/offers/${offerId}/applications`} variant="outline-sm">
            Back to applications
            <Icon name="arrow_back" className="text-[14px]" />
          </ButtonLink>
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
          <DecisionBar
            detail={data}
            busyDecision={decide.isPending ? pendingDecision : null}
            onDecide={setPendingDecision}
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="flex flex-col gap-6 xl:col-span-8">
              <AssessmentCard
                assessment={data.assessment}
                contestedKeys={contestedKeys}
                reportsByKey={reportsByKey}
                onReport={setReportingCriterion}
              />
              <RecruiterQuestionsCard answers={data.answers} />
              <ClarificationsCard clarifications={data.clarifications} />
            </div>
            <div className="flex flex-col gap-6 xl:col-span-4">
              <CvCard
                cv={data.cv}
                busy={download.isPending}
                onDownload={() => {
                  if (data.cv) {
                    download.mutate(data.cv.originalName);
                  }
                }}
              />
              {data.assessment.available ? (
                <ContestsCard contests={data.contests} averageGap={data.averageGap} />
              ) : null}
            </div>
          </div>
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

      {reportingCriterion ? (
        <CriterionReportDialog
          criterion={reportingCriterion}
          busy={report.isPending}
          error={reportError}
          onSubmit={(body) => {
            report.mutate(body, {
              onSuccess: () => setReportingCriterion(null),
            });
          }}
          onClose={() => {
            setReportingCriterion(null);
            report.reset();
          }}
        />
      ) : null}
    </div>
  );
}
