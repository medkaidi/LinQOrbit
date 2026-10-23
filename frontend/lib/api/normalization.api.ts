import {
  parseStatusStreamEvents,
  StatusStreamError,
  streamStatusEvents,
} from "@/lib/api/status-stream";
import type { NormalizationStatusEvent, NormalizationTarget } from "@/types/normalization";

/** Échec d'ouverture du flux de normalisation (statut HTTP conservé pour l'appelant). */
export class NormalizationStreamError extends StatusStreamError {
  constructor(status: number) {
    super(status, `Normalization status stream failed with HTTP ${status}`);
  }
}

/** Chemin du flux SSE de la ressource suivie (D64). */
export function normalizationEventsPath(target: NormalizationTarget): string {
  return target.kind === "candidate"
    ? "/api/v1/candidates/me/profile/normalization/events"
    : `/api/v1/job-offers/${target.offerId}/normalization/events`;
}

/**
 * Extrait les événements « status » complets d'un tampon SSE ; renvoie le reste
 * non terminé (un événement coupé entre deux paquets attend le suivant).
 */
export function parseNormalizationEvents(
  buffer: string,
  onStatus: (event: NormalizationStatusEvent) => void,
): string {
  return parseStatusStreamEvents(buffer, onStatus);
}

/**
 * Flux SSE du statut de normalisation d'une ressource (D64) : chaque
 * transition arrive comme un **signal** `{status}` — le profil ou l'offre se
 * relit par son GET. Ouvert par `fetch` et non `EventSource` (qui ne sait pas
 * envoyer `Authorization`) ni axios (qui ne sait pas streamer côté
 * navigateur) : même base d'URL que l'instance axios unique, même jeton, même
 * effet d'un 401 (`clearAuth`). La promesse se résout à la fermeture du flux
 * par le serveur (statut terminal ou timeout de 120 s).
 */
export async function streamNormalizationStatus(
  target: NormalizationTarget,
  onStatus: (event: NormalizationStatusEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  await streamStatusEvents(
    normalizationEventsPath(target),
    onStatus,
    signal,
    (status) => new NormalizationStreamError(status),
  );
}
