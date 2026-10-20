import { api } from "@/lib/api/axios";
import { useAuthStore } from "@/stores/auth-store";
import type { NormalizationStatusEvent, NormalizationTarget } from "@/types/normalization";

/** Échec d'ouverture du flux de normalisation (statut HTTP conservé pour l'appelant). */
export class NormalizationStreamError extends Error {
  constructor(readonly status: number) {
    super(`Normalization status stream failed with HTTP ${status}`);
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
  const blocks = buffer.replace(/\r\n/g, "\n").split("\n\n");
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    let name = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        name = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        data.push(line.slice("data:".length).trimStart());
      }
    }
    if (name === "status" && data.length > 0) {
      onStatus(JSON.parse(data.join("\n")) as NormalizationStatusEvent);
    }
  }
  return rest;
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
  const token = useAuthStore.getState().token;
  const response = await fetch(`${api.defaults.baseURL}${normalizationEventsPath(target)}`, {
    headers: {
      // problem+json : un refus (404) reste lisible malgré l'Accept SSE.
      Accept: "text/event-stream, application/problem+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });
  if (!response.ok || !response.body) {
    if (response.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    throw new NormalizationStreamError(response.status);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      return;
    }
    buffer = parseNormalizationEvents(buffer + decoder.decode(value, { stream: true }), onStatus);
  }
}
