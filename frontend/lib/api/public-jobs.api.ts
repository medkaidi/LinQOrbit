import { api } from "@/lib/api/axios";
import type { PublicJob } from "@/types/public-job";

/**
 * Lecture publique d'une offre publiée (V15) : sans jeton — le backend
 * répond 404 (détail sûr) sur toute offre inconnue, non publiée, clôturée
 * ou expirée.
 */
export async function getPublicJob(publicId: string): Promise<PublicJob> {
  const { data } = await api.get<PublicJob>(`/api/v1/jobs/${publicId}`);
  return data;
}
