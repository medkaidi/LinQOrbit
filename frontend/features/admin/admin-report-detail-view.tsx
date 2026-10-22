"use client";

import type { ReactNode } from "react";
import { isAxiosError } from "axios";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader,
} from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IndexBadge } from "@/components/ui/index-badge";
import {
  ITEM_CARD_CLASS,
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { RetryButton } from "@/features/admin/retry-button";
import {
  contestSummary,
  ContestGapBlock,
  CRITERION_REASON_LABELS,
  displayScore,
  gapLabel,
  RECRUITER_SECTION_LABELS,
  recruiterSectionLabel,
  ScorePercentChip,
  ScorePercentValue,
  SCORE_UNIT_CLASSES,
} from "@/features/application/recruiter-application-shared";
import { useAdminCriterionReport } from "@/hooks/use-admin";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { formatShortDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { AdminCriterionReport, AdminCriterionReportDetail } from "@/types/admin";
import type {
  RecruiterAssessmentSectionView,
  RecruiterAssessmentView,
  RecruiterContestationView,
  RecruiterCriterionView,
} from "@/types/application";

const MUTED = MUTED_TEXT_CLASS;

function fullName(firstName: string | null, lastName: string | null, fallback: string): string {
  const name = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return name.length > 0 ? name : fallback;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-label-md text-label-md text-text-secondary">{label}</p>
      <div className="mt-1 text-body-md font-body-md text-text-primary break-words">{children}</div>
    </div>
  );
}

/** Carte de section admin : même anatomie que les autres pages de la console. */
function Card({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={SECTION_CARD_CLASS}>
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * Le signalement lui-même : qui l'a posé, quand, sur quel critère et pourquoi.
 * Les deux liens de contexte sont la raison d'être de la page — l'admin doit
 * pouvoir ouvrir l'offre ou le compte candidat sans recopier un identifiant.
 */
function ReportCard({ detail }: { detail: AdminCriterionReportDetail }) {
  const report: AdminCriterionReport = detail.report;
  const author = fullName(report.authorFirstName, report.authorLastName, "Unknown author");
  const candidate = fullName(
    report.candidateFirstName,
    report.candidateLastName,
    "Unknown candidate",
  );

  return (
    <Card title="Report">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        <Field label="Criterion">
          {report.criterionLabel}
          <span className={`${MUTED} block mt-0.5`}>{report.criterionKey}</span>
        </Field>
        <Field label="Reported on">{formatShortDate(report.createdAt)}</Field>
        <Field label="Reported by">
          {author}
          {report.authorEmail ? <span className={`${MUTED} block`}>{report.authorEmail}</span> : null}
        </Field>
        <Field label="Candidate">{candidate}</Field>
        <Field label="Offer">
          {report.offerTitle ?? "Unknown offer"}
          {report.companyName ? <span className={`${MUTED} block`}>{report.companyName}</span> : null}
        </Field>
      </div>

      <div>
        <p className="font-label-md text-label-md text-text-secondary">Comment</p>
        {report.comment ? (
          <blockquote className="mt-1 rounded-lg border border-slate-border bg-item-surface/50 px-4 py-3 text-body-sm font-body-sm text-text-secondary italic whitespace-pre-wrap break-words">
            {report.comment}
          </blockquote>
        ) : (
          <p className={`${MUTED} mt-1`}>No comment.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-border pt-4">
        {report.offerId ? (
          <ButtonLink href={`/admin/offers/${report.offerId}`} variant="outline-sm">
            View offer
          </ButtonLink>
        ) : null}
        {detail.candidateUserId ? (
          <ButtonLink href={`/admin/users/${detail.candidateUserId}`} variant="outline-sm">
            View candidate
          </ButtonLink>
        ) : null}
      </div>
    </Card>
  );
}

/** Ce que l'IA avait noté sur le critère signalé — relu dans le résultat épinglé. */
function CriterionCard({ detail }: { detail: AdminCriterionReportDetail }) {
  const criterion = detail.criterion;
  const section = detail.report.section;

  if (!criterion.resolved) {
    return (
      <Card title="Reported criterion" aside={<Badge tone="neutral">Unresolved</Badge>}>
        <p className={`${MUTED} break-words`}>
          This criterion no longer exists in the pinned AI assessment. The report is kept as-is —
          no score or rationale is shown.
        </p>
        <Field label="Criterion key">{criterion.key}</Field>
      </Card>
    );
  }

  return (
    <Card
      title="Reported criterion"
      aside={
        <div className="flex items-center gap-2">
          <span className={MUTED}>AI score</span>
          <ScorePercentChip score={displayScore(criterion.score)} size="md" />
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        <Field label="Criterion">{criterion.label}</Field>
        <Field label="Section">{recruiterSectionLabel(section) ?? "Unknown section"}</Field>
        <Field label="Section score">
          {criterion.sectionScore === null ? (
            "Not evaluated"
          ) : (
            <ScorePercentValue score={displayScore(criterion.sectionScore)} size="md" />
          )}
        </Field>
        <Field label="Requirement">{criterion.requirement ?? "Not specified"}</Field>
      </div>
      <div>
        <p className="font-label-md text-label-md text-text-secondary">AI rationale</p>
        <p className="mt-1 text-body-sm font-body-sm text-text-secondary whitespace-pre-wrap break-words">
          {criterion.rationale?.trim() ? criterion.rationale : "No AI rationale."}
        </p>
      </div>
    </Card>
  );
}

/**
 * Contestations du candidat : la note propre du candidat est un désaccord, pas
 * une qualité — aucune bande de lecture, l'écart moyen vient du serveur.
 */
function ContestRow({ contest, reported }: { contest: RecruiterContestationView; reported: boolean }) {
  return (
    <li className={ITEM_CARD_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-label-md text-label-md text-text-primary font-bold">{contest.label}</p>
        {reported ? (
          <Badge tone="accent">
            <span className="inline-flex items-center gap-1">
              <Icon name="flag" className="text-[12px]" />
              Reported criterion
            </span>
          </Badge>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl border border-slate-border bg-canvas-white/80 p-2 text-center">
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
        <div className="mt-2 flex flex-col gap-1">
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

function ContestationCard({ detail }: { detail: AdminCriterionReportDetail }) {
  const { contests, averageGap, report } = detail;

  return (
    <Card
      title="Candidate contestation"
      aside={
        contests.length > 0 ? <span className={MUTED}>{contestSummary(contests.length, averageGap)}</span> : null
      }
    >
      {contests.length === 0 ? (
        <p className={MUTED}>The candidate did not contest any criterion of this assessment.</p>
      ) : (
        <>
          <ContestGapBlock averageGap={averageGap} size="md" />
          <ul className="flex flex-col gap-3">
            {contests.map((contest) => (
              <ContestRow
                key={contest.criterionKey}
                contest={contest}
                reported={contest.criterionKey === report.criterionKey}
              />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/** Critère de l'évaluation complète : même lecture que la vue recruteur, sans action. */
function AssessedCriterion({
  criterion,
  reported,
}: {
  criterion: RecruiterCriterionView;
  reported: boolean;
}) {
  const score = displayScore(criterion.score);
  return (
    <li className={ITEM_CARD_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-label-md text-label-md text-text-primary font-bold">
            {criterion.label}
          </p>
          {criterion.requirement ? <p className={MUTED}>{criterion.requirement}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {reported ? (
            <Badge tone="accent">
              <span className="inline-flex items-center gap-1">
                <Icon name="flag" className="text-[12px]" />
                Reported
              </span>
            </Badge>
          ) : null}
          <ScorePercentValue score={score} size="md" />
        </div>
      </div>
      {score !== null ? (
        <div
          role="meter"
          aria-label={criterion.label}
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-2.5 rounded-full border border-slate-border bg-slate-surface p-0.5"
        >
          <div className="h-full rounded-full bg-blue-deep" style={{ width: `${score}%` }} />
        </div>
      ) : null}
      <p className="mt-2 text-body-sm font-body-sm text-text-secondary whitespace-pre-wrap break-words">
        {criterion.rationale.trim() ? criterion.rationale : "No AI rationale."}
      </p>
    </li>
  );
}

function AssessedSection({
  section,
  index,
  reportedKey,
}: {
  section: RecruiterAssessmentSectionView;
  index: number;
  reportedKey: string;
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
          <span className={MUTED}>Not evaluated</span>
        ) : (
          <ScorePercentChip score={score} size="md" />
        )}
      </div>
      {section.criteria.length === 0 ? (
        <p className={MUTED}>No criteria in this section.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {section.criteria.map((criterion) => (
            <AssessedCriterion
              key={criterion.key}
              criterion={criterion}
              reported={criterion.key === reportedKey}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AssessmentCard({
  assessment,
  reportedKey,
}: {
  assessment: RecruiterAssessmentView;
  reportedKey: string;
}) {
  return (
    <Card title="Full AI assessment" aside={<span className={MUTED}>Read-only</span>}>
      {!assessment.available ? (
        <p className={MUTED}>No completed AI assessment is linked to this report.</p>
      ) : (
        <>
          <p className={MUTED}>
            The pinned AI assessment this report refers to. Reporting never changes a score.
          </p>
          <div className="flex flex-col gap-5">
            {assessment.sections.map((section, index) => (
              <AssessedSection
                key={section.section}
                section={section}
                index={index}
                reportedKey={reportedKey}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/**
 * Dossier admin d'un signalement IA (T-86, D66) : le signalement, le critère
 * tel qu'il a été noté dans le résultat épinglé, les contestations du candidat
 * et l'évaluation complète en lecture seule. Aucune action ici — un
 * signalement est interne et immuable, il ne change ni le score ni la décision.
 */
export function AdminReportDetailView({ reportId }: { reportId: string }) {
  const report = useAdminCriterionReport(reportId);

  if (report.isLoading) {
    return <p className={MUTED}>Loading report…</p>;
  }

  if (report.isError || !report.data) {
    const notFound = isAxiosError(report.error) && report.error.response?.status === 404;
    return notFound ? (
      <Alert
        variant="error"
        title="Report not found"
        action={
          <ButtonLink href="/admin/reports" variant="outline-sm">
            Back to AI reports
          </ButtonLink>
        }
      >
        No AI report matches this identifier.
      </Alert>
    ) : (
      <Alert
        variant="error"
        title="Unable to load the report"
        action={<RetryButton onRetry={() => void report.refetch()} label="Try again" />}
      >
        {getApiErrorMessage(report.error)}
      </Alert>
    );
  }

  const detail = report.data;
  const title = detail.criterion.label || detail.report.criterionKey;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbLink href="/admin">Administration</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbLink href="/admin/reports">AI reports</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbCurrent>{title}</BreadcrumbCurrent>
          </Breadcrumb>
        }
        title={title}
        action={
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Badge tone="outline">{CRITERION_REASON_LABELS[detail.report.reason]}</Badge>
            <span className={MUTED}>{formatShortDate(detail.report.createdAt)}</span>
          </div>
        }
      />

      <ReportCard detail={detail} />
      <CriterionCard detail={detail} />
      <ContestationCard detail={detail} />
      <AssessmentCard assessment={detail.assessment} reportedKey={detail.report.criterionKey} />
    </div>
  );
}
