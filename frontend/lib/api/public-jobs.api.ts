import { api } from "@/lib/api/axios";
import type { PublicJob, PublicJobPage } from "@/types/public-job";

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
  params: { page?: number } = {},
  options: { signal?: AbortSignal } = {},
): Promise<PublicJobPage> {
  const response = await api.get<PublicJobPage>("/api/v1/jobs", {
    params: { ...(params.page !== undefined ? { page: params.page } : {}) },
    signal: options.signal,
  });
  return response.data;
}
