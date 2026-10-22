import { api } from "@/lib/api/axios";
import { saveBlob } from "@/lib/utils/download";
import type {
  ApplicationContext,
  ApplicationResponse,
  CriterionReportReason,
  RecruiterApplicationDecision,
  RecruiterApplicationDetail,
  RecruiterApplicationDirection,
  RecruiterApplicationPage,
  RecruiterApplicationSortValue,
  RecruiterApplicationStatusValue,
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

/** Paramètres de la liste recruteur ; `size` reste décidé par le backend. */
export type RecruiterApplicationListParams = {
  status?: RecruiterApplicationStatusValue;
  sort?: RecruiterApplicationSortValue;
  direction?: RecruiterApplicationDirection;
  page?: number;
};

/** Liste paginée des candidatures d'une offre (défaut backend : SUBMITTED, date croissante). */
export async function listRecruiterApplications(
  offerId: string,
  params: RecruiterApplicationListParams = {},
  options: { signal?: AbortSignal } = {},
): Promise<RecruiterApplicationPage> {
  const query: Record<string, string | number> = {};
  if (params.status) {
    query.status = params.status;
  }
  if (params.sort) {
    query.sort = params.sort;
  }
  if (params.direction) {
    query.direction = params.direction;
  }
  if (params.page !== undefined) {
    query.page = params.page;
  }
  const { data } = await api.get<RecruiterApplicationPage>(
    `/api/v1/job-offers/${offerId}/applications`,
    { params: query, signal: options.signal },
  );
  return data;
}

/** Détail complet d'une candidature visible (transmise ou décidée) pour un membre de la company. */
export async function getRecruiterApplication(
  offerId: string,
  applicationId: string,
): Promise<RecruiterApplicationDetail> {
  const { data } = await api.get<RecruiterApplicationDetail>(
    `/api/v1/job-offers/${offerId}/applications/${applicationId}`,
  );
  return data;
}

/** Télécharge le CV épinglé (flux binaire) et déclenche l'enregistrement navigateur. */
export async function downloadRecruiterApplicationCv(
  offerId: string,
  applicationId: string,
  fileName: string,
): Promise<void> {
  const response = await api.get<Blob>(
    `/api/v1/job-offers/${offerId}/applications/${applicationId}/cv`,
    { responseType: "blob" },
  );
  saveBlob(response.data, fileName);
}

/** Décision manuelle et terminale : le backend répond 204, 409 si déjà décidée. */
export async function decideRecruiterApplication(
  offerId: string,
  applicationId: string,
  decision: RecruiterApplicationDecision,
): Promise<void> {
  await api.post(`/api/v1/job-offers/${offerId}/applications/${applicationId}/decision`, {
    decision,
  });
}

/**
 * Signalement interne d'une évaluation IA (D66) : la clé du critère dans le
 * résultat affiché, le motif et le commentaire (obligatoire pour « other »).
 */
export type CriterionReportRequest = {
  criterionKey: string;
  reason: CriterionReportReason;
  comment: string | null;
};

/** Signalement interne d'une évaluation IA par critère (D66) : le backend
 * répond 201. Le critère est désigné par sa clé dans le résultat affiché —
 * le client ne la recalcule jamais.
 */
export async function reportCriterion(
  offerId: string,
  applicationId: string,
  body: CriterionReportRequest,
): Promise<void> {
  await api.post(
    `/api/v1/job-offers/${offerId}/applications/${applicationId}/criterion-reports`,
    body,
  );
}
