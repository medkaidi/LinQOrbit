import { api } from "@/lib/api/axios";
import { StatusStreamError, streamStatusEvents } from "@/lib/api/status-stream";
import type {
  CandidateInvitation,
  ScreeningStatusEvent,
  SuggestedCandidate,
  SuggestedCandidateProfile,
  SuggestedCandidates,
} from "@/types/invitation";

/** Échec d'ouverture du flux de screening (statut HTTP conservé pour l'appelant). */
export class ScreeningStreamError extends StatusStreamError {
  constructor(status: number) {
    super(status, `Screening status stream failed with HTTP ${status}`);
  }
}

/** Chemin du flux SSE du screening d'une offre (T-101). */
export function screeningEventsPath(offerId: string): string {
  return `/api/v1/job-offers/${offerId}/screening/events`;
}

/**
 * Flux SSE du statut de screening d'une offre : chaque transition arrive comme
 * un **signal** `{status, candidateCount}` — l'offre se relit par son GET.
 * Même mécanique que la normalisation (`fetch` + `ReadableStream`, jeton en
 * en-tête, jamais `EventSource`).
 */
export async function streamScreeningStatus(
  offerId: string,
  onStatus: (event: ScreeningStatusEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  await streamStatusEvents(
    screeningEventsPath(offerId),
    onStatus,
    signal,
    (status) => new ScreeningStreamError(status),
  );
}

/** Relance manuelle du screening : le backend répond 202, 409 si le dernier job n'est pas en échec. */
export async function retryScreening(offerId: string): Promise<void> {
  await api.post(`/api/v1/job-offers/${offerId}/screening/retry`);
}

/** Candidats suggérés (ayant consenti) d'une offre publiée, dans l'ordre du screening. */
export async function listSuggestedCandidates(offerId: string): Promise<SuggestedCandidates> {
  const { data } = await api.get<SuggestedCandidates>(
    `/api/v1/job-offers/${offerId}/suggested-candidates`,
  );
  return data;
}

/** Profil complet d'un candidat suggéré (T-102) ; 404 si son consentement a été retiré. */
export async function getSuggestedCandidateProfile(
  offerId: string,
  suggestionId: string,
): Promise<SuggestedCandidateProfile> {
  const { data } = await api.get<SuggestedCandidateProfile>(
    `/api/v1/job-offers/${offerId}/suggested-candidates/${suggestionId}/profile`,
  );
  return data;
}

/** Invite un candidat suggéré à candidater ; renvoie la carte à jour (201). */
export async function inviteSuggestedCandidate(
  offerId: string,
  suggestionId: string,
): Promise<SuggestedCandidate> {
  const { data } = await api.post<SuggestedCandidate>(
    `/api/v1/job-offers/${offerId}/suggested-candidates/${suggestionId}/invitations`,
  );
  return data;
}

/** Invitations à candidater reçues par le candidat connecté. */
export async function listMyInvitations(): Promise<CandidateInvitation[]> {
  const { data } = await api.get<CandidateInvitation[]>("/api/v1/candidates/me/invitations");
  return data;
}
