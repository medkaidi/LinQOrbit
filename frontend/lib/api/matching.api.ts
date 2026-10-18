import { api } from "@/lib/api/axios";
import { useAuthStore } from "@/stores/auth-store";
import type { Matching, MatchingStatusEvent } from "@/types/matching";

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

/** Échec d'ouverture du flux de statut (statut HTTP conservé pour l'appelant). */
export class MatchingStreamError extends Error {
  constructor(readonly status: number) {
    super(`Matching status stream failed with HTTP ${status}`);
  }
}

/** Extrait les événements « status » complets d'un tampon SSE ; renvoie le reste non terminé. */
export function parseStatusEvents(buffer: string, onStatus: (event: MatchingStatusEvent) => void): string {
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
      onStatus(JSON.parse(data.join("\n")) as MatchingStatusEvent);
    }
  }
  return rest;
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
  const token = useAuthStore.getState().token;
  const response = await fetch(`${api.defaults.baseURL}/api/v1/matchings/offer/${publicId}/events`, {
    headers: {
      // problem+json : un refus (404/409) reste lisible malgré l'Accept SSE.
      Accept: "text/event-stream, application/problem+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });
  if (!response.ok || !response.body) {
    if (response.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    throw new MatchingStreamError(response.status);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      return;
    }
    buffer = parseStatusEvents(buffer + decoder.decode(value, { stream: true }), onStatus);
  }
}
