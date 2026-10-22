"use client";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { InfiniteList } from "@/components/ui/infinite-list";
import { Spinner } from "@/components/ui/spinner";
import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader,
} from "@/components/layout/page-header";
import {
  CRITERION_REASON_LABELS,
  recruiterSectionLabel,
} from "@/features/application/recruiter-application-shared";
import { RetryButton } from "@/features/admin/retry-button";
import { useInfiniteAdminCriterionReports } from "@/hooks/use-admin";
import { formatShortDate } from "@/lib/utils/format";
import type { AdminCriterionReport } from "@/types/admin";

const MUTED = "text-body-sm font-body-sm text-text-secondary";

function fullName(
  firstName: string | null,
  lastName: string | null,
  fallback: string,
): string {
  const name = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return name.length > 0 ? name : fallback;
}

/**
 * Un signalement interne d'une évaluation IA (D66) : le critère signalé (libellé
 * et section relus par le serveur dans le résultat épinglé), l'offre et la
 * company, le candidat, l'auteur, le motif et le commentaire.
 */
function ReportRow({ report }: { report: AdminCriterionReport }) {
  const section = recruiterSectionLabel(report.section);
  return (
    <li className="rounded-2xl border border-slate-border bg-item-surface/50 p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-label-md text-label-md text-text-primary font-bold break-words">
            {report.criterionLabel}
          </p>
          <p className={MUTED}>
            {section ? `${section} · ` : ""}
            {report.criterionKey}
          </p>
        </div>
        <Badge tone="outline">{CRITERION_REASON_LABELS[report.reason]}</Badge>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-label-md text-label-md text-text-secondary">Offer</span>
        <p className="text-body-sm font-body-sm text-text-primary break-words">
          {report.offerTitle ?? "Unknown offer"}
          {report.companyName ? ` · ${report.companyName}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <span className="text-body-sm font-body-sm text-text-secondary">
          Candidate:{" "}
          <span className="text-text-primary">
            {fullName(report.candidateFirstName, report.candidateLastName, "Unknown candidate")}
          </span>
        </span>
        <span className="text-body-sm font-body-sm text-text-secondary">
          Reported by:{" "}
          <span className="text-text-primary">
            {fullName(report.authorFirstName, report.authorLastName, "Unknown author")}
          </span>
        </span>
        <span className="text-body-sm font-body-sm text-text-tertiary">
          {formatShortDate(report.createdAt)}
        </span>
      </div>

      {report.comment ? (
        <blockquote className="text-body-sm font-body-sm text-text-secondary italic whitespace-pre-wrap break-words">
          {report.comment}
        </blockquote>
      ) : null}

      <div className="flex justify-end border-t border-slate-border pt-3">
        <ButtonLink href={`/admin/reports/${report.id}`} variant="outline-sm">
          View
        </ButtonLink>
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
      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
          {reports.isError ? (
            <div className="rounded-lg bg-error-subtle p-3 flex items-center justify-between gap-3">
              <span className="text-body-sm font-body-sm text-on-error-container">
                Unable to load the AI reports.
              </span>
              <RetryButton onRetry={() => void reports.refetch()} label="Try again" />
            </div>
          ) : null}
          {reports.isLoading ? (
            <p className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
              <Spinner />
              Loading reports…
            </p>
          ) : null}
          <InfiniteList
            items={items}
            keyExtractor={(report) => report.id}
            renderItem={(report) => <ReportRow report={report} />}
            hasNextPage={reports.hasNextPage}
            isFetchingNextPage={reports.isFetchingNextPage}
            fetchNextPage={() => void reports.fetchNextPage()}
            loading={reports.isLoading}
            empty={<p className={MUTED}>No AI assessment has been reported yet.</p>}
          />
        </div>
      </section>
    </div>
  );
}
