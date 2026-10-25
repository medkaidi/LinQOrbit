import type { CandidateDashboard, DashboardApplication } from "@/types/application";
import type { CandidateProfile } from "@/types/candidate";

/** Profil candidat validé et complet : chaque test écrase seulement ce qui l'intéresse. */
export function buildDashboardProfile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    about: { title: "Engineer", targetPosition: null, bio: "Bio", yearsOfExperience: 5, searchStatus: null },
    experiences: [],
    projects: [],
    diplomas: [],
    skills: [],
    languages: [],
    links: [],
    completionPercentage: 100,
    hasUnvalidatedChanges: false,
    normalizationFailed: false,
    normalizationInProgress: false,
    analysisOutdated: false,
    ...overrides,
  };
}

export function buildDashboardApplication(
  overrides: Partial<DashboardApplication> = {},
): DashboardApplication {
  return {
    id: "a1",
    status: "submitted",
    createdAt: "2026-10-20T10:00:00",
    updatedAt: "2026-10-20T10:00:00",
    job: {
      publicId: "abcdefghijkl",
      slug: "backend-engineer",
      title: "Backend Engineer",
      companyName: "Acme Labs",
    },
    ...overrides,
  };
}

/** Tableau de bord sans aucune activité ; les compteurs se surchargent champ par champ. */
export function buildDashboard(overrides: Partial<CandidateDashboard> = {}): CandidateDashboard {
  return {
    applications: { draft: 0, submitted: 0, withdrawn: 0, accepted: 0, rejected: 0 },
    recentApplications: [],
    openInvitations: 0,
    openOffers: 0,
    ...overrides,
  };
}
