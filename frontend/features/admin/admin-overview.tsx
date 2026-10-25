"use client";

import { DashboardColumns } from "@/components/layout/dashboard-columns";
import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader,
} from "@/components/layout/page-header";
import { LoadError } from "@/components/ui/load-error";
import { NextStepsCard } from "@/components/ui/next-steps-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBreakdownCard } from "@/components/ui/status-breakdown-card";
import { StatusPill } from "@/components/ui/status-pill";
import { ACCOUNT_STATUS_TONES } from "@/features/admin/account-badges";
import {
  ACCOUNT_STATUS_ORDER,
  attentionSteps,
  decisionsLabel,
  identitiesLabel,
  liveOffersLabel,
  moderationLabel,
  moderationTotal,
  newThisWeekLabel,
  PROCESSING_QUEUES,
  processingSummary,
  totalAccountCount,
} from "@/features/admin/dashboard-shared";
import { OFFER_STATUS_TONES, OfferStatusPill } from "@/features/job-offer/job-offer-card";
import { OFFER_STATUS_ORDER, totalOfferCount } from "@/features/recruiter/dashboard-shared";
import { useAdminDashboard } from "@/hooks/use-admin";
import { plural } from "@/lib/utils/format";

/** Valeur d'une carte dont la source n'est pas (encore) disponible : jamais un chiffre inventé. */
const NO_VALUE = "—";

const ACCOUNT_STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
} as const;

/**
 * Tableau de bord de la console admin (D93) : quatre indicateurs réels de la plateforme (comptes,
 * offres ouvertes, candidatures à examiner, files de modération) puis le détail — ce qui attend cet
 * admin, offres par statut, comptes par statut. Tout vient d'un seul appel serveur
 * (`GET /admin/dashboard`). Les échecs de traitement IA sont en lecture seule : le total des jobs
 * définitivement épuisés et encore d'actualité, sans action. Une carte dont la donnée manque affiche « — », jamais un chiffre
 * inventé. Aucune moyenne ni tendance : la base ne les porte pas, seuls les « nouveaux sur 7 jours »
 * existent.
 */
export function AdminOverview() {
  const dashboard = useAdminDashboard();
  const stats = dashboard.data;
  const fallbackBand = dashboard.isError ? "Unavailable" : "Loading…";
  const fallbackPeriod = dashboard.isError ? "Unavailable" : "Loading…";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbCurrent>Administration</BreadcrumbCurrent>
          </Breadcrumb>
        }
        title="Administration"
        subtitle="Here's how the platform is doing."
      />

      {dashboard.isError ? (
        <LoadError
          title="Could not load the platform figures"
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
        />
      ) : null}

      <section
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        aria-label="Key metrics"
      >
        <StatCard
          section="Accounts"
          period={stats ? newThisWeekLabel(stats.accounts.newLast7Days) : fallbackPeriod}
          value={stats ? String(stats.accounts.active) : NO_VALUE}
          caption="active accounts"
          bandTitle="Candidates & recruiters"
          bandTrend={stats ? identitiesLabel(stats.accounts) : fallbackBand}
          bandIcon="group"
          bandClass="bg-orange-deep"
        />
        <StatCard
          section="Offers"
          period="Live"
          value={stats ? String(stats.liveOffers) : NO_VALUE}
          caption="open positions"
          bandTitle="Live job offers"
          bandTrend={stats ? liveOffersLabel(stats.offers) : fallbackBand}
          bandIcon="description"
          bandClass="bg-blue-deep"
        />
        <StatCard
          section="Applications"
          period={stats ? newThisWeekLabel(stats.applications.newLast7Days) : fallbackPeriod}
          value={stats ? String(stats.applications.toReview) : NO_VALUE}
          caption="pending with recruiters"
          bandTitle="Recruiter decisions"
          bandTrend={stats ? decisionsLabel(stats.applications) : fallbackBand}
          bandIcon="inbox"
          bandClass="bg-text-primary"
        />
        <StatCard
          section="Moderation"
          period="Your queues"
          value={stats ? String(moderationTotal(stats.moderation)) : NO_VALUE}
          caption="to moderate"
          bandTitle="Waiting for you"
          bandTrend={stats ? moderationLabel(stats.moderation) : fallbackBand}
          bandIcon="flag"
          bandClass="bg-emerald-deep"
        />
      </section>

      <DashboardColumns
        figures={
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <StatusBreakdownCard
                title="Offers by status"
                summary={stats ? plural(totalOfferCount(stats.offers), "offer") : null}
                rows={OFFER_STATUS_ORDER.map((status) => ({
                  id: status,
                  pill: <OfferStatusPill status={status} />,
                  value: stats ? String(stats.offers[status]) : NO_VALUE,
                  amount: stats ? stats.offers[status] : undefined,
                  barClass: OFFER_STATUS_TONES[status].dot,
                }))}
              />
              <StatusBreakdownCard
                title="Accounts by status"
                summary={stats ? plural(totalAccountCount(stats.accounts), "account") : null}
                rows={ACCOUNT_STATUS_ORDER.map((status) => ({
                  id: status,
                  pill: (
                    <StatusPill tone={ACCOUNT_STATUS_TONES[status]}>{ACCOUNT_STATUS_LABELS[status]}</StatusPill>
                  ),
                  value: stats ? String(stats.accounts[status]) : NO_VALUE,
                  amount: stats ? stats.accounts[status] : undefined,
                  barClass: ACCOUNT_STATUS_TONES[status].dot,
                }))}
              />
            </div>
            <StatusBreakdownCard
              title="AI processing failures"
              summary={stats ? processingSummary(stats.processingFailures) : null}
              rows={PROCESSING_QUEUES.map((queue) => ({
                id: queue.key,
                pill: <span className="font-body-sm text-body-sm text-text-primary">{queue.label}</span>,
                value: stats ? String(stats.processingFailures[queue.key]) : NO_VALUE,
              }))}
            />
          </>
        }
        actions={
          <NextStepsCard
            title="Needs your attention"
            steps={stats ? attentionSteps(stats.moderation) : []}
            state={stats ? "ready" : dashboard.isError ? "failed" : "loading"}
            readyMessage="Nothing to review — the moderation queues are empty."
            failedMessage="The moderation queues could not be loaded."
          />
        }
      />
    </div>
  );
}
