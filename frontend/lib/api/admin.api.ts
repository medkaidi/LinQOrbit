import { api } from "@/lib/api/axios";
import type { CandidateProfile } from "@/types/candidate";
import type {
  AdminCandidateNormalizedProfile,
  AdminDashboard,
  AdminCriterionReportDetail,
  AdminCriterionReportPage,
  AdminCriterionReportReview,
  AdminCriterionReportReviewPayload,
  AdminJobOfferDetail,
  AdminJobOfferFilters,
  AdminJobOfferPage,
  AdminOfferNormalizedProfile,
  AdminSkillSuggestion,
  AdminUser,
  AdminUserDetail,
  AdminUserFilters,
  AdminUserPage,
} from "@/types/admin";

const BASE = "/api/v1/admin";

/** Chiffres du tableau de bord admin (un appel, compteurs agrégés côté serveur). */
export async function getAdminDashboard(): Promise<AdminDashboard> {
  const { data } = await api.get<AdminDashboard>(`${BASE}/dashboard`);
  return data;
}

/** La taille de page n'est jamais envoyée : le backend décide (D34). */
export async function listUsers(
  params: { page?: number } & AdminUserFilters = {},
  options: { signal?: AbortSignal } = {},
): Promise<AdminUserPage> {
  const response = await api.get<AdminUserPage>(`${BASE}/users`, {
    params: {
      ...(params.page !== undefined ? { page: params.page } : {}),
      ...(params.q ? { q: params.q } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.capability ? { capability: params.capability } : {}),
    },
    signal: options.signal,
  });
  return response.data;
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  const response = await api.get<AdminUserDetail>(`${BASE}/users/${userId}`);
  return response.data;
}

/** Profil professionnel d'un candidat, même payload que la vue du candidat (D38). */
export async function getAdminUserProfile(userId: string): Promise<CandidateProfile> {
  const response = await api.get<CandidateProfile>(`${BASE}/users/${userId}/profile`);
  return response.data;
}

export async function getUserNormalizedProfile(
  userId: string,
): Promise<AdminCandidateNormalizedProfile> {
  const response = await api.get<AdminCandidateNormalizedProfile>(
    `${BASE}/users/${userId}/normalized-profile`,
  );
  return response.data;
}

/** Historique des versions (D37) : toutes les versions, de la plus récente à la plus ancienne. */
export async function getUserNormalizedProfileVersions(
  userId: string,
): Promise<AdminCandidateNormalizedProfile[]> {
  const response = await api.get<AdminCandidateNormalizedProfile[]>(
    `${BASE}/users/${userId}/normalized-profile/versions`,
  );
  return response.data;
}

/**
 * La taille de page n'est jamais envoyée : le backend décide (D34). Un filtre
 * vide ou absent n'est jamais envoyé (T-110).
 */
export async function listAllJobOffers(
  params: { page?: number } & AdminJobOfferFilters = {},
  options: { signal?: AbortSignal } = {},
): Promise<AdminJobOfferPage> {
  const response = await api.get<AdminJobOfferPage>(`${BASE}/job-offers`, {
    params: {
      ...(params.page !== undefined ? { page: params.page } : {}),
      ...(params.q ? { q: params.q } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.workModeId ? { workModeId: params.workModeId } : {}),
      ...(params.contractTypeId ? { contractTypeId: params.contractTypeId } : {}),
      ...(params.employmentTypeId ? { employmentTypeId: params.employmentTypeId } : {}),
      ...(params.seniority ? { seniority: params.seniority } : {}),
      ...(params.expiry ? { expiry: params.expiry } : {}),
    },
    signal: options.signal,
  });
  return response.data;
}

export async function getAdminJobOffer(offerId: string): Promise<AdminJobOfferDetail> {
  const response = await api.get<AdminJobOfferDetail>(`${BASE}/job-offers/${offerId}`);
  return response.data;
}

export async function getOfferNormalizedProfile(
  offerId: string,
): Promise<AdminOfferNormalizedProfile> {
  const response = await api.get<AdminOfferNormalizedProfile>(
    `${BASE}/job-offers/${offerId}/normalized-profile`,
  );
  return response.data;
}

/** Historique des versions (D37) : toutes les versions, de la plus récente à la plus ancienne. */
export async function getOfferNormalizedProfileVersions(
  offerId: string,
): Promise<AdminOfferNormalizedProfile[]> {
  const response = await api.get<AdminOfferNormalizedProfile[]>(
    `${BASE}/job-offers/${offerId}/normalized-profile/versions`,
  );
  return response.data;
}

export async function updateUserStatus(
  userId: string,
  status: AdminUser["status"],
): Promise<void> {
  await api.patch(`${BASE}/users/${userId}/status`, { status });
}

export async function listSkillSuggestions(): Promise<AdminSkillSuggestion[]> {
  const response = await api.get<AdminSkillSuggestion[]>(`${BASE}/skill-suggestions`);
  return response.data;
}

export async function approveSkillSuggestion(
  id: string,
  body: { category: string; skillType: string },
): Promise<void> {
  await api.post(`${BASE}/skill-suggestions/${id}/approve`, body);
}

export async function linkSkillSuggestion(id: string, skillId: string): Promise<void> {
  await api.post(`${BASE}/skill-suggestions/${id}/link`, { skillId });
}

export async function rejectSkillSuggestion(id: string): Promise<void> {
  await api.post(`${BASE}/skill-suggestions/${id}/reject`);
}

/**
 * Signalements internes d'évaluations IA (D66), du plus récent au plus
 * ancien. La taille de page n'est jamais envoyée : le backend décide (D34).
 */
export async function listCriterionReports(
  params: { page?: number } = {},
  options: { signal?: AbortSignal } = {},
): Promise<AdminCriterionReportPage> {
  const response = await api.get<AdminCriterionReportPage>(`${BASE}/criterion-reports`, {
    params: {
      ...(params.page !== undefined ? { page: params.page } : {}),
    },
    signal: options.signal,
  });
  return response.data;
}

/**
 * Dossier d'un signalement (T-86, D66) : critère relu dans le résultat
 * épinglé, évaluation complète, contestations du candidat. Lecture seule.
 */
export async function getCriterionReport(
  id: string,
  options: { signal?: AbortSignal } = {},
): Promise<AdminCriterionReportDetail> {
  const response = await api.get<AdminCriterionReportDetail>(`${BASE}/criterion-reports/${id}`, {
    signal: options.signal,
  });
  return response.data;
}

/**
 * Avis final de l'admin courant sur un signalement (T-96) : un seul avis par
 * admin, jamais modifiable. Le corps ne porte que les champs autorisés —
 * l'appelant masque déjà les corrections quand le verdict n'est pas `upheld`.
 */
export async function createCriterionReportReview(
  id: string,
  body: AdminCriterionReportReviewPayload,
): Promise<AdminCriterionReportReview> {
  const response = await api.post<AdminCriterionReportReview>(
    `${BASE}/criterion-reports/${id}/reviews`,
    body,
  );
  return response.data;
}
