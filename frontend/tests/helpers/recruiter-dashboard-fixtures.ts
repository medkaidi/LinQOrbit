import type { DashboardAttentionOffer, RecruiterDashboard } from "@/types/recruiter";

/** Tableau de bord recruteur vide (tout à zéro) : chaque test écrase seulement ce qui l'intéresse. */
export function buildRecruiterDashboard(overrides: Partial<RecruiterDashboard> = {}): RecruiterDashboard {
  return {
    offers: { draft: 0, validated: 0, published: 0, closed: 0 },
    liveOffers: 0,
    closingSoon: { count: 0, nextExpiry: null },
    applications: { toReview: 0, accepted: 0, rejected: 0 },
    candidates: { toInvite: 0, invited: 0, searchesFailed: 0 },
    attention: [],
    ...overrides,
  };
}

export function buildAttentionOffer(overrides: Partial<DashboardAttentionOffer> = {}): DashboardAttentionOffer {
  return {
    id: "offer-1",
    title: "Staff Backend Engineer",
    status: "published",
    expiresAt: null,
    toReview: 0,
    screening: null,
    ...overrides,
  };
}
