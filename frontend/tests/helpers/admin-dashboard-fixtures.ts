import type { AdminDashboard } from "@/types/admin";

/** Tableau de bord admin vide (tout à zéro) : chaque test écrase seulement ce qui l'intéresse. */
export function buildAdminDashboard(overrides: Partial<AdminDashboard> = {}): AdminDashboard {
  return {
    accounts: {
      active: 0,
      inactive: 0,
      suspended: 0,
      candidates: 0,
      recruiters: 0,
      admins: 0,
      newLast7Days: 0,
    },
    offers: { draft: 0, validated: 0, published: 0, closed: 0 },
    liveOffers: 0,
    applications: { toReview: 0, accepted: 0, rejected: 0, newLast7Days: 0 },
    moderation: { skillSuggestions: 0, reportsAwaitingMyReview: 0, reportsTotal: 0 },
    processingFailures: { candidateAnalyses: 0, offerAnalyses: 0, embeddings: 0, screenings: 0, matchings: 0 },
    ...overrides,
  };
}
