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
import { IconBadge } from "@/components/ui/icon-badge";
import { IndexBadge } from "@/components/ui/index-badge";
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
  candidateInitials,
  contestCountLabel,
  displayScore,
  RECRUITER_SECTION_LABELS,
  recruiterAnswerValue,
  recruiterCandidateName,
  ScorePercentChip,
  ScorePercentValue,
  SCORE_UNIT_CLASSES,
  submittedOnLabel,
} from "@/features/application/recruiter-application-shared";
import {
  useDecideRecruiterApplication,
  useDownloadRecruiterApplicationCv,
  useRecruiterApplication,
} from "@/hooks/use-recruiter-applications";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { formatFileSize } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type {
  RecruiterAnswerView,
  RecruiterApplicationDecision,
  RecruiterApplicationDetail,
  RecruiterAssessmentSectionView,
  RecruiterAssessmentView,
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

function gapLabel(gap: number): string {
  return Number.isInteger(gap) ? String(gap) : gap.toFixed(1);
}

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

function SectionHeader({
  title,
  icon,
  aside,
}: {
  title: string;
  icon: string;
  aside?: string;
}) {
  return (
    <header className={SECTION_HEADER_CLASS}>
      <div className="flex min-w-0 items-center gap-2.5">
        <IconBadge icon={icon} />
        <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
      </div>
      {aside ? <span className={MUTED_TEXT_CLASS}>{aside}</span> : null}
    </header>
  );
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
    <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-border bg-canvas-white px-4 py-3 shadow-sm">
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

/** CV épinglé à la transmission : nom, taille réelle et téléchargement streamé. */
function CvAttachment({
  cv,
  busy,
  onDownload,
}: {
  cv: RecruiterCvSummary | null;
  busy: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-border bg-item-surface/50 px-3 py-1.5 text-body-sm font-body-sm text-text-primary">
        <Icon name="description" className="text-[16px] text-text-tertiary" />
        <span className="truncate">{cv ? cv.originalName : "No CV pinned"}</span>
        {cv && cv.sizeBytes !== null ? (
          <span className="text-text-tertiary">{formatFileSize(cv.sizeBytes)}</span>
        ) : null}
      </span>
      <Button variant="outline-sm" busy={busy} disabled={!cv} onClick={onDownload}>
        Download CV
      </Button>
    </div>
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
 * Critère evalué : exigence, score en pourcentage, barre bleue et justification
 * IA. Le critère contesté par le candidat est signalé — le désaccord se lit
 * sans croiser avec le panneau des contestations.
 */
function CriterionRow({
  criterion,
  contested,
}: {
  criterion: RecruiterCriterionView;
  contested: boolean;
}) {
  const score = displayScore(criterion.score);
  return (
    <li className={ITEM_CARD_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-label-md text-label-md text-text-primary font-bold">
            {criterion.label}
          </p>
          {criterion.requirement ? (
            <p className={MUTED_TEXT_CLASS}>{criterion.requirement}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {contested ? <Badge tone="accent">Contested</Badge> : null}
          <ScorePercentValue score={score} size="md" />
        </div>
      </div>
      {score === null ? null : (
        <div
          role="meter"
          aria-label={criterion.label}
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-2.5 rounded-full border border-slate-border bg-slate-surface p-0.5"
        >
          <div
            className="h-full rounded-full bg-blue-deep transition-[width] duration-500 ease-out"
            style={{ width: `${score}%` }}
          />
        </div>
      )}
      <p className="mt-2 text-body-sm font-body-sm text-text-secondary whitespace-pre-wrap break-words">
        {criterion.rationale.trim() ? criterion.rationale : "No AI rationale."}
      </p>
    </li>
  );
}

/** Section du matching : score agrégé (pastille) puis critère par critère. */
function AssessmentSection({
  section,
  index,
  contestedKeys,
}: {
  section: RecruiterAssessmentSectionView;
  index: number;
  contestedKeys: Set<string>;
}) {
  const score = displayScore(section.score);
  return (
    <section
      className={cn(index > 0 && "border-t border-slate-border pt-5", "flex flex-col gap-3")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <IndexBadge>{index + 1}</IndexBadge>
          <h3 className="font-headline-sm text-headline-sm text-text-primary font-semibold min-w-0 break-words">
            {RECRUITER_SECTION_LABELS[section.section]}
          </h3>
        </div>
        {score === null ? (
          <span className={MUTED_TEXT_CLASS}>Not evaluated</span>
        ) : (
          <ScorePercentChip score={score} size="md" />
        )}
      </div>
      {section.criteria.length === 0 ? (
        <p className={MUTED_TEXT_CLASS}>No criteria in this section.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {section.criteria.map((criterion) => (
            <CriterionRow
              key={criterion.key}
              criterion={criterion}
              contested={contestedKeys.has(criterion.key)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Contestation d'un critère : note IA, note du candidat, écart et argumentaire.
 * Aucune bande de lecture sur ces valeurs : la note propre du candidat n'est
 * pas un score de qualité, l'écart est un signal de désaccord.
 */
function Contest({ contest }: { contest: RecruiterContestationView }) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-slate-border bg-canvas-white/80 p-3">
      <p className="font-label-md text-label-md text-text-primary font-bold">{contest.label}</p>
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-border bg-item-surface/60 p-2 text-center">
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
        <blockquote className="border-l-2 border-orange-border pl-3 text-body-sm font-body-sm text-text-secondary italic whitespace-pre-wrap break-words">
          {contest.comment}
        </blockquote>
      ) : null}
    </li>
  );
}

/**
 * Panneau des contestations : orange quand le candidat conteste, gris sinon
 * (même code couleur que la carte de liste). Masqué sans évaluation IA.
 */
function ContestsCard({ contests }: { contests: RecruiterContestationView[] }) {
  const contested = contests.length > 0;
  return (
    <section className={SECTION_CARD_CLASS} aria-label="Contests">
      <SectionHeader title="Contests" icon="compare_arrows" aside={contestCountLabel(contests.length)} />
      <div className="px-5 pt-4 pb-5">
        {contested ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-orange-border/70 bg-orange-subtle/60 p-3">
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

/** Évaluation IA épinglée : score par section, justification par critère. */
function AssessmentCard({
  assessment,
  contestedKeys,
}: {
  assessment: RecruiterAssessmentView;
  contestedKeys: Set<string>;
}) {
  const sections = assessment.sections.filter(
    (section) => section.score !== null || section.criteria.length > 0,
  );
  return (
    <section className={SECTION_CARD_CLASS} aria-label="AI assessment">
      <SectionHeader
        title="AI assessment"
        icon="insights"
        aside={assessment.available ? "Pinned matching result" : undefined}
      />
      <div className="px-5 pt-4 pb-5 flex flex-col gap-5">
        {!assessment.available ? (
          <p className={MUTED_TEXT_CLASS}>No AI assessment was attached to this application.</p>
        ) : sections.length === 0 ? (
          <p className={MUTED_TEXT_CLASS}>No section was evaluated.</p>
        ) : (
          sections.map((section, index) => (
            <AssessmentSection
              key={section.section}
              section={section}
              index={index}
              contestedKeys={contestedKeys}
            />
          ))
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-label-md text-label-md text-text-primary font-bold min-w-0 break-words">
                    {clarification.question}
                  </h3>
                  <Badge tone="outline">
                    {CLARIFICATION_STATUS_LABELS[clarification.status]}
                  </Badge>
                </div>
                {clarification.rationale ? (
                  <div className="mt-2 rounded-xl border border-blue-border bg-blue-surface/60 px-3 py-2">
                    <span className="flex items-center gap-1.5 font-label-md text-label-md font-bold text-blue-deep">
                      <Icon name="help_outline" className="text-[14px]" />
                      Why the AI asked this
                    </span>
                    <p className="mt-1 text-body-sm font-body-sm text-text-secondary whitespace-pre-wrap break-words">
                      {clarification.rationale}
                    </p>
                  </div>
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
  const [pendingDecision, setPendingDecision] = useState<RecruiterApplicationDecision | null>(null);

  const data = application.data;
  const name = data ? recruiterCandidateName(data.candidate) : "Application";
  const candidateTitle = data?.candidate?.title?.trim() || null;
  const errorMessage = application.isError ? getApiErrorMessage(application.error) : null;
  const decideError = decide.error ? getApiErrorMessage(decide.error) : null;
  const contestedKeys = new Set((data?.contests ?? []).map((contest) => contest.criterionKey));

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
          <span className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-border bg-blue-surface font-headline-sm text-headline-sm font-bold text-blue-deep"
            >
              {candidateInitials(name)}
            </span>
            <span className="min-w-0">{name}</span>
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
      >
        {data ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {candidateTitle ? (
              <span className="text-body-sm font-body-sm font-semibold text-text-secondary">
                {candidateTitle}
              </span>
            ) : null}
            <CvAttachment
              cv={data.cv}
              busy={download.isPending}
              onDownload={() => {
                if (data.cv) {
                  download.mutate(data.cv.originalName);
                }
              }}
            />
          </div>
        ) : null}
      </PageHeader>

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
              <AssessmentCard assessment={data.assessment} contestedKeys={contestedKeys} />
              <RecruiterQuestionsCard answers={data.answers} />
              <ClarificationsCard clarifications={data.clarifications} />
            </div>
            <div className="flex flex-col gap-6 xl:col-span-4">
              {data.assessment.available ? <ContestsCard contests={data.contests} /> : null}
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
    </div>
  );
}
