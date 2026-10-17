import { api } from "@/lib/api/axios";
import type {
  ApplicationContext,
  ApplicationResponse,
  SubmitApplicationRequest,
} from "@/types/application";

/**
 * Contexte d'une offre publiée pour le formulaire de candidature (offre,
 * questions de présélection sans `preferred`, CV courant, candidature
 * existante éventuelle) — 404 sur toute offre indisponible.
 */
export async function getApplicationContext(publicId: string): Promise<ApplicationContext> {
  const { data } = await api.get<ApplicationContext>(`/api/v1/applications/context/${publicId}`);
  return data;
}

/** Soumission : `answers` vide/absente ≡ aucune réponse ; `cvAttachmentId` absent ≡ CV courant. */
export async function submitApplication(
  body: SubmitApplicationRequest,
): Promise<ApplicationResponse> {
  const { data } = await api.post<ApplicationResponse>("/api/v1/applications", body);
  return data;
}

/** Candidatures du candidat connecté (tous statuts), les plus récentes d'abord. */
export async function listMyApplications(): Promise<ApplicationResponse[]> {
  const { data } = await api.get<ApplicationResponse[]>("/api/v1/applications/mine");
  return data;
}

/** Retrait terminal (MVP, D49) : une candidature retirée ne peut plus l'être à nouveau. */
export async function withdrawApplication(applicationId: string): Promise<void> {
  await api.post(`/api/v1/applications/${applicationId}/withdraw`);
}
