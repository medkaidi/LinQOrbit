"use client";

import { Icon } from "@/components/ui/icon";
import { InfiniteList } from "@/components/ui/infinite-list";
import { NavPill } from "@/components/ui/nav-pill";
import { Spinner } from "@/components/ui/spinner";
import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader
} from "@/components/layout/page-header";
import {
  candidateInitials,
  CRITERION_REASON_LABELS,
  displayScore,
  recruiterSectionLabel,
  ScorePercentChip
} from "@/features/application/recruiter-application-shared";
import { RetryButton } from "@/features/admin/retry-button";
import { useInfiniteAdminCriterionReports } from "@/hooks/use-admin";
import { formatShortDate } from "@/lib/utils/format";
import type { AdminCriterionReport } from "@/types/admin";
import type { CriterionReportReason } from "@/types/application";

const MUTED = "text-body-sm font-body-sm text-text-secondary";
const FIELD_LABEL =
  "font-label-caps text-label-caps uppercase text-text-tertiary";
const SCORE_LABEL = "font-label-caps text-label-caps uppercase text-blue-deep";

/** Couleurs de lecture du motif — aucune sévérité, aucune priorité inventée. */
const REASON_CHIP_CLASSES: Record<CriterionReportReason, string> = {
  scoreIncorrect: "border-orange-border bg-orange-subtle text-orange-deep",
  evidenceWrong: "border-blue-border bg-blue-surface text-blue-deep",
  profileMisunderstood:
    "border-secondary-fixed-dim bg-secondary-container text-on-secondary-fixed",
  requirementMisunderstood:
    "border-slate-border-strong bg-surface-container-low text-slate-ink",
  other: "border-slate-border bg-canvas-subtle text-text-secondary"
};

/** Repère de section : couleur de catégorie, jamais de statut. */
const SECTION_DOT_CLASSES: Record<string, string> = {
  requiredSkills: "bg-blue-deep",
  preferredSkills: "bg-secondary",
  languages: "bg-orange-deep",
  experience: "bg-slate-muted",
  education: "bg-slate-ink"
};

function fullName(
  firstName: string | null,
  lastName: string | null,
  fallback: string
): string {
  const name = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return name.length > 0 ? name : fallback;
}

function ReasonChip({ reason }: { reason: CriterionReportReason }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 font-label-caps text-label-caps normal-case tracking-normal font-bold ${REASON_CHIP_CLASSES[reason]}`}
    >
      {CRITERION_REASON_LABELS[reason]}
    </span>
  );
}

function SectionLabel({ section }: { section: string | null }) {
  const label = recruiterSectionLabel(section);
  const dot = SECTION_DOT_CLASSES[section ?? ""] ?? "bg-text-tertiary";
  return (
    <span className="inline-flex items-center gap-1.5 font-label-caps text-label-caps uppercase text-text-secondary">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label ?? "Unknown section"}
    </span>
  );
}

function ScoreField({ label, score }: { label: string; score: number | null }) {
  const value = displayScore(score);
  return (
    <div
      role="group"
      aria-label={`${label} score: ${value === null ? "Not resolved" : `${value}%`}`}
      className="flex flex-col gap-1"
    >
      <span className="font-label-md text-label-md text-text-secondary">
        {label}
      </span>
      {value === null ? (
        <span className="text-body-sm font-body-sm text-text-tertiary">
          Not resolved
        </span>
      ) : (
        <ScorePercentChip score={value} size="md" />
      )}
    </div>
  );
}

/**
 * Un signalement interne d'une évaluation IA (D66, D75) : carte de dossier
 * en trois zones — contexte (critère, offre, candidat, auteur), scores réels
 * relus dans le résultat épinglé, puis commentaire et action.
 */
function ReportCard({ report }: { report: AdminCriterionReport }) {
  const candidateName = fullName(
    report.candidateFirstName,
    report.candidateLastName,
    "Unknown candidate"
  );
  const authorName = fullName(
    report.authorFirstName,
    report.authorLastName,
    "Unknown author"
  );

  return (
    <li className="rounded-lg border border-slate-border bg-canvas-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SectionLabel section={report.section} />
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h3 className="font-headline-sm text-headline-sm font-semibold text-text-primary break-words">
                  {report.criterionLabel}
                </h3>
                <span className="text-body-sm font-body-sm text-text-tertiary break-all">
                  {report.criterionKey}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={FIELD_LABEL}>Reason</span>
              <ReasonChip reason={report.reason} />
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border border-blue-border bg-blue-surface/60 px-3 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-canvas-white text-blue-deep shadow-sm">
              <Icon name="work" className="text-[16px]" />
            </span>
            <p className="min-w-0 text-body-sm font-body-sm text-text-secondary break-words">
              <span className="font-semibold text-text-primary">
                {report.offerTitle ?? "Unknown offer"}
              </span>
              {report.companyName ? (
                <>
                  <span aria-hidden="true" className="text-text-tertiary">
                    {" · "}
                  </span>
                  <span className="text-text-secondary">
                    {report.companyName}
                  </span>
                </>
              ) : null}
            </p>
          </div>

        </div>

        <div className="flex flex-col gap-2.5 rounded-lg border border-blue-border bg-blue-surface/60 p-6 lg:col-span-3">
          <p className={SCORE_LABEL}>Reported scores</p>
          <div className="flex flex-1 flex-col justify-center">
            <div className="grid grid-cols-2 gap-2">
              <ScoreField label="Criterion" score={report.score} />
              <ScoreField label="Section" score={report.sectionScore} />
            </div>
          </div>
        </div>

        <div className="flex flex-col rounded-lg border border-slate-border bg-canvas-subtle p-6 lg:col-span-4">
          <p className={FIELD_LABEL}>Comment</p>
          {report.comment ? (
            <blockquote className="mt-1.5 text-body-sm font-body-sm text-text-secondary italic whitespace-pre-wrap break-words">
              {report.comment}
            </blockquote>
          ) : (
            <p className="mt-1.5 text-body-sm font-body-sm text-text-tertiary">
              No comment.
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-border pt-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-surface font-label-md text-label-md font-bold text-blue-deep">
              {candidateInitials(candidateName)}
            </span>
            <span className="text-body-sm font-body-sm text-text-tertiary">
              Candidate
            </span>
            <span className="text-body-sm font-body-sm text-text-primary break-words">
              {candidateName}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary-container font-label-md text-label-md font-bold text-on-secondary-fixed">
              {candidateInitials(authorName)}
            </span>
            <span className="text-body-sm font-body-sm text-text-tertiary">
              Reported by
            </span>
            <span className="text-body-sm font-body-sm text-text-primary break-words">
              {authorName}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-body-sm font-body-sm text-text-tertiary">
            <Icon name="event" className="text-[14px]" />
            {formatShortDate(report.createdAt)}
          </span>
        </div>
        <NavPill
          icon="arrow_forward"
          label="View"
          href={`/admin/reports/${report.id}`}
          tone="secondary"
        />
      </div>
    </li>
  );
}

/**
 * Console admin — signalements internes d'évaluations IA (D66), du plus récent
 * au plus ancien. Une liste en infinite scroll, la taille de page reste
 * décidée par le backend.
 */
export function AdminReportsSection() {
  const reports = useInfiniteAdminCriterionReports();
  const items = reports.data?.pages.flatMap((page) => page.items) ?? [];
  const total = reports.data?.pages[0]?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbLink href="/admin">Administration</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbCurrent>AI reports</BreadcrumbCurrent>
          </Breadcrumb>
        }
        title="AI reports"
        action={
          reports.data ? (
            <span className={MUTED}>
              {total} {total === 1 ? "report" : "reports"}
            </span>
          ) : null
        }
      />
      <section aria-label="AI reports list" className="flex flex-col gap-4">
        {reports.isError ? (
          <div className="rounded-lg bg-error-subtle p-3 flex items-center justify-between gap-3">
            <span className="text-body-sm font-body-sm text-on-error-container">
              Unable to load the AI reports.
            </span>
            <RetryButton
              onRetry={() => void reports.refetch()}
              label="Try again"
            />
          </div>
        ) : null}
        {reports.isLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-border bg-canvas-white p-4 text-body-sm font-body-sm text-text-secondary shadow-sm">
            <Spinner />
            Loading reports…
          </div>
        ) : null}
        <InfiniteList
          items={items}
          keyExtractor={(report) => report.id}
          renderItem={(report) => <ReportCard report={report} />}
          hasNextPage={reports.hasNextPage}
          isFetchingNextPage={reports.isFetchingNextPage}
          fetchNextPage={() => void reports.fetchNextPage()}
          loading={reports.isLoading}
          listClassName="flex flex-col gap-3"
          empty={
            reports.isError ? undefined : (
              <div className="rounded-lg border border-dashed border-slate-border bg-canvas-white p-5">
                <p className={MUTED}>No AI assessment has been reported yet.</p>
              </div>
            )
          }
        />
      </section>
    </div>
  );
}
