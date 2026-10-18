import { api } from "@/lib/api/axios";
import type {
  ApplicationContext,
  ApplicationResponse,
  SaveApplicationDraftRequest,
  SubmitApplicationRequest,
} from "@/types/application";

/**
 * Contexte du parcours de candidature d'une offre publiée (questions sans
 * `preferred`, CV courant, candidature du couple et ses réponses, étape
 * calculée par le serveur) — 404 sur toute offre indisponible.
 */
export async function getApplicationContext(publicId: string): Promise<ApplicationContext> {
  const { data } = await api.get<ApplicationContext>(`/api/v1/applications/context/${publicId}`);
  return data;
}

/** Brouillon (D59) : créé au premier enregistrement, réponses remplacées ensuite — partiel permis. */
export async function saveApplicationDraft(
  body: SaveApplicationDraftRequest,
): Promise<ApplicationResponse> {
  const { data } = await api.put<ApplicationResponse>("/api/v1/applications/draft", body);
  return data;
}

/** Transmission du brouillon : `cvAttachmentId` absent ≡ CV du brouillon, sinon CV courant. */
export async function submitApplication(
  applicationId: string,
  body: SubmitApplicationRequest = {},
): Promise<ApplicationResponse> {
  const { data } = await api.post<ApplicationResponse>(
    `/api/v1/applications/${applicationId}/submit`,
    body,
  );
  return data;
}

/** Abandon d'un brouillon (suppression ; le matching du couple est conservé). */
export async function discardApplication(applicationId: string): Promise<void> {
  await api.delete(`/api/v1/applications/${applicationId}`);
}

/** Candidatures du candidat connecté (brouillons compris), les plus récentes d'abord. */
export async function listMyApplications(): Promise<ApplicationResponse[]> {
  const { data } = await api.get<ApplicationResponse[]>("/api/v1/applications/mine");
  return data;
}

/** Retrait terminal (MVP, D49) : une candidature retirée ne peut plus l'être à nouveau. */
export async function withdrawApplication(applicationId: string): Promise<void> {
  await api.post(`/api/v1/applications/${applicationId}/withdraw`);
}
