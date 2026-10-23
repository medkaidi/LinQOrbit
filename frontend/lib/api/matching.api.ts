import { api } from "@/lib/api/axios";
import {
  parseStatusStreamEvents,
  StatusStreamError,
  streamStatusEvents,
} from "@/lib/api/status-stream";
import type { AssessmentFeedbackValues } from "@/lib/validations/matching.schemas";
import type {
  Matching,
  MatchingFeedbackResponse,
  MatchingStatusEvent,
  SaveMatchingFeedbackRequest,
} from "@/types/matching";

/**
 * Lance (ou reprend) le matching du candidat pour une offre publiée (D58) :
 * analyse asynchrone — le statut se suit par la lecture. 409 si les questions
 * obligatoires du recruteur manquent, si la candidature est transmise ou si
 * une fiche normalisée est absente ou périmée (détail affiché tel quel).
 */
export async function startMatching(jobPublicId: string): Promise<Matching> {
  const { data } = await api.post<Matching>("/api/v1/matchings", { jobPublicId });
  return data;
}

/** Matching courant du couple pour la fiche courante du candidat — 404 si aucun n'a été lancé. */
export async function getCurrentMatching(publicId: string): Promise<Matching> {
  const { data } = await api.get<Matching>(`/api/v1/matchings/offer/${publicId}`);
  return data;
}

/**
 * Réponse à la question IA ouverte (T-62) → 202 + matching en `pending` : une
 * réévaluation démarre, suivie par le flux SSE. 409 si la question est déjà
 * fermée, le matching fermé ou une analyse en cours.
 */
export async function answerClarification(
  publicId: string,
  clarificationId: string,
  answer: string,
): Promise<Matching> {
  const { data } = await api.post<Matching>(
    `/api/v1/matchings/offer/${publicId}/clarifications/${clarificationId}/answer`,
    { answer },
  );
  return data;
}

/** Question passée (T-62) : même mécanique que la réponse, consomme un cran du plafond. */
export async function skipClarification(publicId: string, clarificationId: string): Promise<Matching> {
  const { data } = await api.post<Matching>(
    `/api/v1/matchings/offer/${publicId}/clarifications/${clarificationId}/skip`,
  );
  return data;
}

/** Clôt l'évaluation (T-62) → 204, idempotent : la question ouverte se ferme, plus aucune après. */
export async function finishAssessment(publicId: string): Promise<void> {
  await api.post(`/api/v1/matchings/offer/${publicId}/assessment/finish`);
}

/**
 * Corps de la contestation (T-63) : un critère sans score est **omis** (donc
 * supprimé — le PUT remplace tout), score en nombre, commentaire vide → null.
 */
export function toMatchingFeedbackPayload(values: AssessmentFeedbackValues): SaveMatchingFeedbackRequest {
  return {
    items: values.items
      .filter((item) => item.selfValue !== "")
      .map((item) => ({
        criterionKey: item.criterionKey,
        selfValue: Number(item.selfValue),
        comment: item.comment.trim() === "" ? null : item.comment.trim(),
      })),
  };
}

/** Contestation du dernier résultat (T-63) : remplacement complet, aucun recalcul des scores. */
export async function saveMatchingFeedback(
  publicId: string,
  values: AssessmentFeedbackValues,
): Promise<MatchingFeedbackResponse> {
  const { data } = await api.put<MatchingFeedbackResponse>(
    `/api/v1/matchings/offer/${publicId}/feedback`,
    toMatchingFeedbackPayload(values),
  );
  return data;
}

/** Échec d'ouverture du flux de statut (statut HTTP conservé pour l'appelant). */
export class MatchingStreamError extends StatusStreamError {
  constructor(status: number) {
    super(status, `Matching status stream failed with HTTP ${status}`);
  }
}

/** Extrait les événements « status » complets d'un tampon SSE ; renvoie le reste non terminé. */
export function parseStatusEvents(
  buffer: string,
  onStatus: (event: MatchingStatusEvent) => void,
): string {
  return parseStatusStreamEvents(buffer, onStatus);
}

/**
 * Flux SSE du statut de l'analyse (D60) : chaque transition arrive comme un
 * **signal** `{matchingId, status}` — le résultat se relit par
 * `getCurrentMatching`. Ouvert par `fetch` et non `EventSource` (qui ne sait
 * pas envoyer `Authorization`) ni axios (qui ne sait pas streamer côté
 * navigateur) : seule exception à l'instance axios unique, même base d'URL,
 * même jeton, même effet d'un 401 (`clearAuth`). La promesse se résout à la
 * fermeture du flux par le serveur (statut terminal ou timeout).
 */
export async function streamMatchingStatus(
  publicId: string,
  onStatus: (event: MatchingStatusEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  await streamStatusEvents(
    `/api/v1/matchings/offer/${publicId}/events`,
    onStatus,
    signal,
    (status) => new MatchingStreamError(status),
  );
}
