"use client";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import { queryKeys } from "@/hooks/query-keys";
import { useStatusStream } from "@/hooks/use-status-stream";
import { streamNormalizationStatus } from "@/lib/api/normalization.api";
import type { NormalizationStatusEvent, NormalizationTarget } from "@/types/normalization";

/** Requêtes relues à chaque signal : le GET de la ressource reste la source de vérité. */
function refreshedKeys(target: NormalizationTarget): QueryKey[] {
  return target.kind === "candidate"
    ? [queryKeys.candidate.profile]
    : [queryKeys.jobOffers.list, queryKeys.jobOffers.detail(target.offerId)];
}

/**
 * Push SSE du statut de normalisation (D64) : **un** flux par ressource,
 * ouvert seulement pendant une analyse (`active` = `normalizationInProgress`).
 * Chaque événement invalide la ressource (le GET reste la vérité affichée) ;
 * un statut terminal arrête l'écoute, un flux fermé par le serveur alors que
 * l'analyse continue (timeout 120 s) est rouvert, l'écoute est coupée au
 * démontage. Après tout échec, la ressource est relue ; un refus (4xx) arrête
 * l'écoute, une coupure réseau ou une erreur serveur la reprend après
 * {@link RECONNECT_DELAY_MS}, au plus {@link MAX_NETWORK_RETRIES} fois de suite.
 */
function useNormalizationStatusStream(target: NormalizationTarget, active: boolean) {
  const queryClient = useQueryClient();
  const streamKey = target.kind === "candidate" ? "candidate" : `offer:${target.offerId}`;

  useStatusStream<NormalizationStatusEvent>({
    active,
    streamKey,
    stream: (onStatus, signal) => streamNormalizationStatus(target, onStatus, signal),
    isTerminal: (event) => event.status !== "pending" && event.status !== "running",
    refresh: () =>
      Promise.all(
        refreshedKeys(target).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  });
}

/** Flux du profil du candidat connecté : relit `GET …/me/profile` à chaque signal. */
export function useCandidateNormalizationStream(active: boolean) {
  useNormalizationStatusStream({ kind: "candidate" }, active);
}

/** Flux d'une offre : relit la liste et le détail de l'offre à chaque signal. */
export function useOfferNormalizationStream(offerId: string, active: boolean) {
  useNormalizationStatusStream({ kind: "offer", offerId }, active);
}
