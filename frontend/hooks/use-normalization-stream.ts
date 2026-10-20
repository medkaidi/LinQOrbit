"use client";

import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import { queryKeys } from "@/hooks/query-keys";
import { NormalizationStreamError, streamNormalizationStatus } from "@/lib/api/normalization.api";
import type { NormalizationStatus, NormalizationTarget } from "@/types/normalization";

/** Délai avant de rouvrir un flux fermé par le serveur (timeout) ou coupé par le réseau. */
const RECONNECT_DELAY_MS = 1_000;
/**
 * Reconnexions après la tentative initiale, sur échecs réseau ou serveur consécutifs, avant
 * d'abandonner l'écoute : 1 + 5 ouvertures au plus (compteur remis à zéro à chaque événement).
 */
const MAX_NETWORK_RETRIES = 5;

/** Seuls `pending` et `running` laissent espérer une transition : tout le reste clôt l'écoute. */
function isTerminal(status: NormalizationStatus): boolean {
  return status !== "pending" && status !== "running";
}

/** Refus du serveur (404 offre hors company, 401…) : définitif, inutile de réessayer. */
function isRefusal(error: unknown): boolean {
  return error instanceof NormalizationStreamError && error.status < 500;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

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
  const offerId = target.kind === "offer" ? target.offerId : null;

  useEffect(() => {
    if (!active) {
      return;
    }
    const resource: NormalizationTarget = offerId === null ? { kind: "candidate" } : { kind: "offer", offerId };
    const controller = new AbortController();
    const refresh = () =>
      Promise.all(
        refreshedKeys(resource).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );

    const listen = async () => {
      let finished = false;
      let failures = 0;
      while (!controller.signal.aborted && !finished) {
        try {
          await streamNormalizationStatus(
            resource,
            (event) => {
              failures = 0;
              finished = isTerminal(event.status);
              void refresh();
            },
            controller.signal,
          );
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          void refresh();
          failures += 1;
          if (isRefusal(error) || failures > MAX_NETWORK_RETRIES) {
            return;
          }
        }
        if (!finished) {
          await wait(RECONNECT_DELAY_MS, controller.signal);
        }
      }
    };
    void listen();

    return () => controller.abort();
  }, [offerId, active, queryClient]);
}

/** Flux du profil du candidat connecté : relit `GET …/me/profile` à chaque signal. */
export function useCandidateNormalizationStream(active: boolean) {
  useNormalizationStatusStream({ kind: "candidate" }, active);
}

/** Flux d'une offre : relit la liste et le détail de l'offre à chaque signal. */
export function useOfferNormalizationStream(offerId: string, active: boolean) {
  useNormalizationStatusStream({ kind: "offer", offerId }, active);
}
