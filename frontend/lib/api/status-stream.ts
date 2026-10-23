import { api } from "@/lib/api/axios";
import { useAuthStore } from "@/stores/auth-store";

/** Échec d'ouverture d'un flux SSE ; le statut HTTP est conservé pour l'appelant. */
export class StatusStreamError extends Error {
  constructor(
    readonly status: number,
    message = `Status stream failed with HTTP ${status}`,
  ) {
    super(message);
  }
}

/**
 * Extrait les événements « status » complets d'un tampon SSE ; renvoie le
 * reste non terminé (un événement coupé entre deux paquets attend le suivant).
 */
export function parseStatusStreamEvents<T>(
  buffer: string,
  onStatus: (event: T) => void,
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
      onStatus(JSON.parse(data.join("\n")) as T);
    }
  }
  return rest;
}

/**
 * Ouvre un flux SSE de statuts avec `fetch` (ni `EventSource`, qui n'envoie pas
 * `Authorization`, ni axios, qui ne streame pas côté navigateur). Chaque
 * transition est un **signal** : la ressource se relit par son GET. La promesse
 * se résout à la fermeture du flux par le serveur ; un 401 vide la session.
 *
 * @param errorFactory conserve le type d'erreur public de chaque flux
 */
export async function streamStatusEvents<T>(
  url: string,
  onStatus: (event: T) => void,
  signal: AbortSignal,
  errorFactory: (status: number) => StatusStreamError,
): Promise<void> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${api.defaults.baseURL}${url}`, {
    headers: {
      // problem+json : un refus (401/404/409) reste lisible malgré l'Accept SSE.
      Accept: "text/event-stream, application/problem+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });
  if (!response.ok || !response.body) {
    if (response.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    throw errorFactory(response.status);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      return;
    }
    buffer = parseStatusStreamEvents(buffer + decoder.decode(value, { stream: true }), onStatus);
  }
}
