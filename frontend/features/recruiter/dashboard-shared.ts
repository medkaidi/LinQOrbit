import type { NextStep } from "@/components/ui/next-steps-card";
import { plural } from "@/lib/utils/format";
import type { JobOfferStatusValue, RecruiterDashboard } from "@/types/recruiter";

/** Ordre du cycle de vie d'une offre, tel que « Offers by status » le déroule. */
export const OFFER_STATUS_ORDER: JobOfferStatusValue[] = ["draft", "validated", "published", "closed"];

export function totalOfferCount(offers: RecruiterDashboard["offers"]): number {
  return OFFER_STATUS_ORDER.reduce((total, status) => total + offers[status], 0);
}

/** Décisions sur les candidatures, telles que « Applications by decision » les déroule. */
export const DECISION_ORDER = ["toReview", "accepted", "rejected"] as const;

export function totalDecisionCount(applications: RecruiterDashboard["applications"]): number {
  return DECISION_ORDER.reduce((total, decision) => total + applications[decision], 0);
}

/** Bande de la carte « Live offers » : ce qui attend avant d'être publiable. */
export function liveOffersLabel(offers: RecruiterDashboard["offers"]): string {
  return `${offers.draft} ${offers.draft === 1 ? "draft" : "drafts"} · ${offers.validated} validated`;
}

/** Bande de la carte « Applications to review » : les décisions déjà prises. */
export function decisionsLabel(applications: RecruiterDashboard["applications"]): string {
  return `${applications.accepted} accepted · ${applications.rejected} rejected`;
}

/** Bande de la carte « Candidates to invite ». */
export function invitedLabel(candidates: RecruiterDashboard["candidates"]): string {
  return candidates.invited > 0 ? `${candidates.invited} invited so far` : "No invitation sent yet";
}

/** « 2026-11-03 » → « Nov 3, 2026 » sans passer par un fuseau (la date serveur est une date civile). */
export function dateLabel(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) {
    return null;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

/** Bande de la carte « Closing soon » : la plus proche échéance, ou l'absence d'échéance. */
export function closingSoonLabel(closingSoon: RecruiterDashboard["closingSoon"]): string {
  const next = closingSoon.nextExpiry ? dateLabel(closingSoon.nextExpiry) : null;
  return next ? `Next on ${next}` : "None in the next 30 days";
}

/**
 * Prochaines étapes déduites de l'état réel, de la plus urgente à la moins urgente :
 * décider des candidatures, relancer une recherche en échec, inviter, publier, terminer un
 * brouillon, puis surveiller les échéances. Sans offre, la seule étape est d'en créer une.
 */
export function nextSteps(dashboard: RecruiterDashboard): NextStep[] {
  const steps: NextStep[] = [];
  const { offers, applications, candidates, closingSoon, attention } = dashboard;

  if (totalOfferCount(offers) === 0) {
    return [
      {
        id: "first-offer",
        icon: "add_circle",
        title: "Create your first offer",
        detail: "Offers are what candidates apply to.",
        href: "/recruiter/offers/new",
      },
    ];
  }
  if (applications.toReview > 0) {
    const first = attention.find((offer) => offer.toReview > 0);
    steps.push({
      id: "review",
      icon: "inbox",
      title: `Review ${plural(applications.toReview, "application")}`,
      detail: "Candidates are waiting for a decision.",
      href: first ? `/recruiter/offers/${first.id}/applications` : "/recruiter",
    });
  }
  if (candidates.searchesFailed > 0) {
    steps.push({
      id: "failed-searches",
      icon: "refresh",
      title: `Retry ${plural(candidates.searchesFailed, "failed candidate search")}`,
      detail: "The automatic search did not finish.",
      href: "/recruiter",
    });
  }
  if (candidates.toInvite > 0) {
    steps.push({
      id: "invite",
      icon: "group",
      title: `Invite ${plural(candidates.toInvite, "suggested candidate")}`,
      detail: "Suggested for your open offers.",
      href: "/recruiter",
    });
  }
  if (offers.validated > 0) {
    steps.push({
      id: "publish",
      icon: "campaign",
      title: `Publish ${plural(offers.validated, "validated offer")}`,
      detail: "Validated offers are not visible to candidates yet.",
      href: "/recruiter",
    });
  }
  if (offers.draft > 0) {
    steps.push({
      id: "drafts",
      icon: "edit_note",
      title: `Finish ${plural(offers.draft, "draft")}`,
      detail: "Complete and validate them to publish.",
      href: "/recruiter",
    });
  }
  if (closingSoon.count > 0) {
    steps.push({
      id: "closing-soon",
      icon: "schedule",
      title: `${plural(closingSoon.count, "offer")} closing soon`,
      detail: closingSoonLabel(closingSoon),
      href: "/recruiter",
    });
  }
  return steps;
}
