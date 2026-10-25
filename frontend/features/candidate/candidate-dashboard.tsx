"use client";

import Link from "next/link";

import { DashboardColumns } from "@/components/layout/dashboard-columns";
import { LINK_ACCENT_CLASS } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { LoadError } from "@/components/ui/load-error";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { Spinner } from "@/components/ui/spinner";
import { NextStepsCard } from "@/components/ui/next-steps-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBreakdownCard } from "@/components/ui/status-breakdown-card";
import {
  APPLICATION_STATUS_TONES,
  ApplicationStatusPill,
  appliedOnLabel,
} from "@/features/application/application-shared";
import {
  draftsLabel,
  invitationsLabel,
  nextSteps,
  profileStateLabel,
  sentApplicationCount,
  totalApplicationCount,
} from "@/features/candidate/dashboard-shared";
import { companyInitials } from "@/features/job-offer/job-offer-shared";
import { useCandidateDashboard } from "@/hooks/use-applications";
import { useCandidateCvs } from "@/hooks/use-candidate-cvs";
import { useCandidateProfile, useVisibilityConsent } from "@/hooks/use-candidate-profile";
import { plural } from "@/lib/utils/format";
import type { ApplicationCounts, ApplicationStatusValue, DashboardApplication } from "@/types/application";

/** Valeur d'une carte dont la source n'est pas (encore) disponible : jamais un chiffre inventé. */
const NO_VALUE = "—";

const PIPELINE_ORDER: ApplicationStatusValue[] = [
  "draft",
  "submitted",
  "accepted",
  "rejected",
  "withdrawn",
];

function LatestApplicationRow({ application }: { application: DashboardApplication }) {
  const { job } = application;
  const startedOn = appliedOnLabel(application.createdAt);
  const mark =
    companyInitials(job.companyName ?? "") || job.title.trim().charAt(0).toUpperCase() || "?";

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-surface text-body-sm font-bold text-blue-deep"
        >
          {mark}
        </span>
        <div className="min-w-0">
          <Link
            href={`/jobs/${job.publicId}-${job.slug}`}
            className={`${LINK_ACCENT_CLASS} block truncate font-label-lg text-label-lg font-bold text-text-primary`}
          >
            {job.title}
          </Link>
          <p className="truncate text-body-sm font-body-sm text-text-tertiary">
            {[job.companyName, startedOn ? `Started ${startedOn}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <ApplicationStatusPill status={application.status} />
    </li>
  );
}

function LatestApplications({ items, loading }: { items: DashboardApplication[] | null; loading: boolean }) {
  return (
    <section className={SECTION_CARD_CLASS} aria-label="Latest applications">
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Latest applications</h2>
        {items && items.length > 0 ? (
          <Link href="/applications" className={`${LINK_ACCENT_CLASS} ${MUTED_TEXT_CLASS}`}>
            View all
          </Link>
        ) : null}
      </header>
      <div className="px-6 pt-5 pb-6">
        {loading ? (
          <span className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
            <Spinner />
            Loading…
          </span>
        ) : null}
        {items && items.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className={MUTED_TEXT_CLASS}>You have not applied to any job offer yet.</p>
            <ButtonLink variant="outline-sm" href="/jobs">
              Browse offers
            </ButtonLink>
          </div>
        ) : null}
        {items && items.length > 0 ? (
          <ul className="flex flex-col divide-y divide-slate-border">
            {items.map((application) => (
              <LatestApplicationRow key={application.id} application={application} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function ApplicationPipeline({ counts }: { counts: ApplicationCounts | null }) {
  return (
    <StatusBreakdownCard
      title="Application pipeline"
      summary={counts ? plural(totalApplicationCount(counts), "application") : null}
      rows={PIPELINE_ORDER.map((status) => ({
        id: status,
        pill: <ApplicationStatusPill status={status} />,
        value: counts ? String(counts[status]) : NO_VALUE,
        amount: counts ? counts[status] : undefined,
        barClass: APPLICATION_STATUS_TONES[status].dot,
      }))}
    />
  );
}

type SourceState = "loading" | "failed" | "ready";

/**
 * Tableau de bord du compte candidat : quatre indicateurs réels (profil,
 * candidatures envoyées, invitations ouvertes, offres ouvertes) puis le détail
 * — dernières candidatures, répartition par statut, prochaines étapes. Chaque
 * source se charge et échoue seule : une carte dont la donnée manque affiche
 * « — », jamais un chiffre inventé. Aucun score de matching global : le
 * candidat ne voit que les scores par critère (D58).
 */
export function CandidateDashboard() {
  const dashboard = useCandidateDashboard();
  const profile = useCandidateProfile();
  const consent = useVisibilityConsent();
  const cvs = useCandidateCvs();

  const stats = dashboard.data;
  const profileData = profile.data;
  const sources = [dashboard, profile, consent, cvs];
  // Une source en erreur ne se confond ni avec « tout est réglé » ni avec un chargement sans fin.
  const state: SourceState = sources.some((query) => query.isLoading)
    ? "loading"
    : sources.some((query) => query.isError)
      ? "failed"
      : "ready";

  return (
    <>
      {dashboard.isError ? (
        <LoadError
          title="Could not load your activity"
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
        />
      ) : null}
      {profile.isError ? (
        <LoadError
          title="Could not load your profile status"
          error={profile.error}
          onRetry={() => void profile.refetch()}
        />
      ) : null}

      <section
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        aria-label="Key metrics"
      >
        <StatCard
          section="Profile"
          period="Now"
          value={profileData ? `${profileData.completionPercentage}%` : NO_VALUE}
          caption="complete"
          bandTitle="Profile strength"
          bandTrend={profileData ? profileStateLabel(profileData) : profile.isError ? "Unavailable" : "Loading…"}
          bandIcon="person"
          bandClass="bg-orange-deep"
        />
        <StatCard
          section="Applications"
          period="All time"
          value={stats ? String(sentApplicationCount(stats.applications)) : NO_VALUE}
          caption="sent"
          bandTitle="Applications sent"
          bandTrend={stats ? draftsLabel(stats.applications.draft) : dashboard.isError ? "Unavailable" : "Loading…"}
          bandIcon="send"
          bandClass="bg-text-primary"
        />
        <StatCard
          section="Invitations"
          period="Open now"
          value={stats ? String(stats.openInvitations) : NO_VALUE}
          caption="from recruiters"
          bandTitle="Invitations to apply"
          bandTrend={stats ? invitationsLabel(stats.openInvitations) : dashboard.isError ? "Unavailable" : "Loading…"}
          bandIcon="mail"
          bandClass="bg-blue-deep"
        />
        <StatCard
          section="Job board"
          period="Live"
          value={stats ? String(stats.openOffers) : NO_VALUE}
          caption="open positions"
          bandTitle="Browse offers"
          bandTrend={stats ? "Published and not expired" : dashboard.isError ? "Unavailable" : "Loading…"}
          bandIcon="work"
          bandClass="bg-emerald-deep"
        />
      </section>

      <DashboardColumns
        figures={
          <>
            <ApplicationPipeline counts={stats ? stats.applications : null} />
            <LatestApplications
              items={stats ? stats.recentApplications : null}
              loading={dashboard.isLoading}
            />
          </>
        }
        actions={
          <NextStepsCard
            state={state}
            steps={nextSteps({
              profile: profileData,
              dashboard: stats,
              consent: consent.data,
              cvs: cvs.data,
            })}
          />
        }
      />
    </>
  );
}
