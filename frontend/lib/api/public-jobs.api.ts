import { api } from "@/lib/api/axios";
import type {
  PublicJob,
  PublicJobFilters,
  PublicJobListItem,
  PublicJobPage,
} from "@/types/public-job";

/**
 * Lecture publique d'une offre publiée (V15) : sans jeton — le backend
 * répond 404 (détail sûr) sur toute offre inconnue, non publiée, clôturée
 * ou expirée.
 */
export async function getPublicJob(publicId: string): Promise<PublicJob> {
  const { data } = await api.get<PublicJob>(`/api/v1/jobs/${publicId}`);
  return data;
}

/**
 * Job board public (T-72) : offres publiées non expirées, enveloppe D34.
 * La taille de page n'est jamais envoyée : le backend décide.
 */
export async function listPublicJobs(
  params: { page?: number } & PublicJobFilters = {},
  options: { signal?: AbortSignal } = {},
): Promise<PublicJobPage> {
  const response = await api.get<PublicJobPage>("/api/v1/jobs", {
    params: {
      ...(params.page !== undefined ? { page: params.page } : {}),
      ...(params.q ? { q: params.q } : {}),
      ...(params.workModeId ? { workModeId: params.workModeId } : {}),
      ...(params.contractTypeId ? { contractTypeId: params.contractTypeId } : {}),
      ...(params.employmentTypeId ? { employmentTypeId: params.employmentTypeId } : {}),
      ...(params.seniority ? { seniority: params.seniority } : {}),
      ...(params.country ? { country: params.country } : {}),
      ...(params.sort ? { sort: params.sort } : {}),
    },
    signal: options.signal,
  });
  return response.data;
}

/**
 * « More from this company » (T-74) : autres offres publiées non expirées de
 * la même entreprise — tableau borné par le backend, jamais une page.
 */
export async function getRelatedPublicJobs(
  publicId: string,
  options: { signal?: AbortSignal } = {},
): Promise<PublicJobListItem[]> {
  const response = await api.get<PublicJobListItem[]>(
    `/api/v1/jobs/${publicId}/related`,
    { signal: options.signal },
  );
  return response.data;
}
