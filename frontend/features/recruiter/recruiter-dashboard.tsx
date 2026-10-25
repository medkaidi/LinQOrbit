"use client";

import Link from "next/link";

import { DashboardColumns } from "@/components/layout/dashboard-columns";
import { LINK_ACCENT_CLASS } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
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
import { StatusPill } from "@/components/ui/status-pill";
import { APPLICATION_STATUS_TONES } from "@/features/application/application-shared";
import { ScreeningBadge } from "@/features/invitation/screening-badge";
import { OFFER_STATUS_TONES, OfferStatusPill } from "@/features/job-offer/job-offer-card";
import { expiryCountdown, isOfferExpired } from "@/features/job-offer/job-offer-shared";
import {
  DECISION_ORDER,
  OFFER_STATUS_ORDER,
  closingSoonLabel,
  dateLabel,
  decisionsLabel,
  invitedLabel,
  liveOffersLabel,
  nextSteps,
  totalDecisionCount,
  totalOfferCount,
} from "@/features/recruiter/dashboard-shared";
import { useRecruiterDashboard } from "@/hooks/use-job-offers";
import { useRecruiterReady } from "@/hooks/use-recruiter-ready";
import { plural } from "@/lib/utils/format";
import type { DashboardAttentionOffer, RecruiterDashboard as RecruiterDashboardData } from "@/types/recruiter";

/** Valeur d'une carte dont la source n'est pas (encore) disponible : jamais un chiffre inventé. */
const NO_VALUE = "—";

function expiryLabel(offer: DashboardAttentionOffer): string | null {
  if (!offer.expiresAt) {
    return null;
  }
  if (isOfferExpired(offer)) {
    return "Expired";
  }
  return expiryCountdown(offer.expiresAt)?.label ?? `Expires ${dateLabel(offer.expiresAt) ?? offer.expiresAt}`;
}

function AttentionRow({ offer }: { offer: DashboardAttentionOffer }) {
  const href =
    offer.toReview > 0
      ? `/recruiter/offers/${offer.id}/applications`
      : `/recruiter/offers/${offer.id}/preview`;
  const expiry = expiryLabel(offer);

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={href}
          className={`${LINK_ACCENT_CLASS} min-w-0 truncate font-label-lg text-label-lg font-bold text-text-primary`}
        >
          {offer.title}
        </Link>
        <OfferStatusPill status={offer.status} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {offer.toReview > 0 ? (
          <Badge tone="accent">{plural(offer.toReview, "application")} to review</Badge>
        ) : null}
        {expiry ? <Badge tone="outline">{expiry}</Badge> : null}
        {offer.status === "published" ? (
          <ScreeningBadge offerId={offer.id} screening={offer.screening} />
        ) : null}
      </div>
    </li>
  );
}

function OffersNeedingAttention({ offers, loading }: { offers: DashboardAttentionOffer[] | null; loading: boolean }) {
  return (
    <section className={SECTION_CARD_CLASS} aria-label="Offers needing attention">
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Offers needing attention</h2>
        <Link href="/recruiter" className={`${LINK_ACCENT_CLASS} ${MUTED_TEXT_CLASS}`}>
          View all offers
        </Link>
      </header>
      <div className="px-6 pt-5 pb-6">
        {loading ? (
          <span className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
            <Spinner />
            Loading…
          </span>
        ) : null}
        {offers && offers.length === 0 ? (
          <p className={MUTED_TEXT_CLASS}>No offer needs your attention right now.</p>
        ) : null}
        {offers && offers.length > 0 ? (
          <ul className="flex flex-col divide-y divide-slate-border">
            {offers.map((offer) => (
              <AttentionRow key={offer.id} offer={offer} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function OffersByStatus({ offers }: { offers: RecruiterDashboardData["offers"] | null }) {
  return (
    <StatusBreakdownCard
      title="Offers by status"
      summary={offers ? plural(totalOfferCount(offers), "offer") : null}
      rows={OFFER_STATUS_ORDER.map((status) => ({
        id: status,
        pill: <OfferStatusPill status={status} />,
        value: offers ? String(offers[status]) : NO_VALUE,
        amount: offers ? offers[status] : undefined,
        barClass: OFFER_STATUS_TONES[status].dot,
      }))}
    />
  );
}

/** Décision → libellé et ton (les tons des candidatures : « à examiner » = transmise). */
const DECISIONS = {
  toReview: { label: "To review", tone: APPLICATION_STATUS_TONES.submitted },
  accepted: { label: "Accepted", tone: APPLICATION_STATUS_TONES.accepted },
  rejected: { label: "Rejected", tone: APPLICATION_STATUS_TONES.rejected },
} as const;

function ApplicationsByDecision({ applications }: { applications: RecruiterDashboardData["applications"] | null }) {
  return (
    <StatusBreakdownCard
      title="Applications by decision"
      summary={applications ? plural(totalDecisionCount(applications), "application") : null}
      rows={DECISION_ORDER.map((decision) => ({
        id: decision,
        pill: <StatusPill tone={DECISIONS[decision].tone}>{DECISIONS[decision].label}</StatusPill>,
        value: applications ? String(applications[decision]) : NO_VALUE,
        amount: applications ? applications[decision] : undefined,
        barClass: DECISIONS[decision].tone.dot,
      }))}
    />
  );
}

/**
 * Tableau de bord du compte recruteur : quatre indicateurs réels (offres ouvertes, candidatures
 * à examiner, candidats à inviter, échéances proches) puis le détail — offres à regarder, offres
 * par statut, prochaines étapes. Tout vient d'un seul appel serveur (`GET /recruiters/me/dashboard`).
 * Une carte dont la donnée manque affiche « — », jamais un chiffre inventé. Aucune moyenne de
 * matching, aucun délai d'embauche, aucune tendance : la base ne les porte pas.
 *
 * Sans profil recruteur ou sans société, **rien** n'est rendu et l'endpoint n'est pas interrogé :
 * l'amorçage du compte appartient à l'espace recruteur, le tableau de bord ne crée rien, ne
 * redirige pas et n'en parle pas.
 */
export function RecruiterDashboard() {
  const { ready, error, refetch } = useRecruiterReady();
  const dashboard = useRecruiterDashboard({ enabled: ready });

  if (error) {
    return <LoadError title="Could not load your recruiter account" error={error} onRetry={refetch} />;
  }
  if (!ready) {
    return null;
  }

  const stats = dashboard.data;
  const pending = dashboard.isLoading;
  const fallbackBand = dashboard.isError ? "Unavailable" : "Loading…";

  return (
    <>
      {dashboard.isError ? (
        <LoadError
          title="Could not load your hiring activity"
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
        />
      ) : null}

      <section
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        aria-label="Key metrics"
      >
        <StatCard
          section="Offers"
          period="Live"
          value={stats ? String(stats.liveOffers) : NO_VALUE}
          caption="open positions"
          bandTitle="Live job offers"
          bandTrend={stats ? liveOffersLabel(stats.offers) : fallbackBand}
          bandIcon="description"
          bandClass="bg-orange-deep"
        />
        <StatCard
          section="Applications"
          period="Now"
          value={stats ? String(stats.applications.toReview) : NO_VALUE}
          caption="to review"
          bandTitle="Waiting for a decision"
          bandTrend={stats ? decisionsLabel(stats.applications) : fallbackBand}
          bandIcon="inbox"
          bandClass="bg-text-primary"
        />
        <StatCard
          section="Candidates"
          period="Open offers"
          value={stats ? String(stats.candidates.toInvite) : NO_VALUE}
          caption="to invite"
          bandTitle="Candidates to invite"
          bandTrend={stats ? invitedLabel(stats.candidates) : fallbackBand}
          bandIcon="group"
          bandClass="bg-blue-deep"
        />
        <StatCard
          section="Deadlines"
          period="Next 30 days"
          value={stats ? String(stats.closingSoon.count) : NO_VALUE}
          caption="closing soon"
          bandTitle="Offers closing soon"
          bandTrend={stats ? closingSoonLabel(stats.closingSoon) : fallbackBand}
          bandIcon="schedule"
          bandClass="bg-emerald-deep"
        />
      </section>

      <DashboardColumns
        figures={
          <>
            <OffersByStatus offers={stats ? stats.offers : null} />
            <ApplicationsByDecision applications={stats ? stats.applications : null} />
          </>
        }
        actions={
          <>
            <NextStepsCard
              steps={stats ? nextSteps(stats) : []}
              state={stats ? "ready" : pending ? "loading" : "failed"}
              failedMessage="Your hiring status could not be loaded."
            />
            <OffersNeedingAttention offers={stats ? stats.attention : null} loading={pending} />
          </>
        }
      />
    </>
  );
}
