import { api } from "@/lib/api/axios";
import type { CandidateProfile } from "@/types/candidate";
import type {
  AdminCandidateNormalizedProfile,
  AdminJobOfferDetail,
  AdminJobOfferPage,
  AdminJobOfferStatus,
  AdminOfferNormalizedProfile,
  AdminSkillSuggestion,
  AdminUser,
  AdminUserDetail,
} from "@/types/admin";

const BASE = "/api/v1/admin";

export async function listUsers(): Promise<AdminUser[]> {
  const response = await api.get<AdminUser[]>(`${BASE}/users`);
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

/** La taille de page n'est jamais envoyée : le backend décide (D34). */
export async function listAllJobOffers(
  params: {
    status?: AdminJobOfferStatus;
    page?: number;
  } = {},
  options: { signal?: AbortSignal } = {},
): Promise<AdminJobOfferPage> {
  const response = await api.get<AdminJobOfferPage>(`${BASE}/job-offers`, {
    params: {
      ...(params.status !== undefined ? { status: params.status } : {}),
      ...(params.page !== undefined ? { page: params.page } : {}),
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
