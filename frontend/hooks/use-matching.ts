"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getCurrentMatching, startMatching, streamMatchingStatus } from "@/lib/api/matching.api";
import { queryKeys } from "@/hooks/query-keys";
import type { MatchingStatus } from "@/types/matching";

/** Délai avant de rouvrir un flux fermé par le serveur (timeout) alors que l'analyse continue. */
const RECONNECT_DELAY_MS = 1_000;

/**
 * Matching courant du couple (D58). Retry coupé : 404 = aucun matching lancé,
 * 409 = candidature transmise — réponses définitives. Pendant une analyse,
 * l'état suit tout seul via `useMatchingStatusStream` (push SSE, D60).
 */
export function useCurrentMatching(publicId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.matching.current(publicId),
    queryFn: () => getCurrentMatching(publicId),
    enabled: options?.enabled ?? true,
    retry: false,
  });
}

/** Lancement ou reprise : la réponse devient le matching courant en cache. */
export function useStartMatching(publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startMatching(publicId),
    onSuccess: (matching) => queryClient.setQueryData(queryKeys.matching.current(publicId), matching),
  });
}

function isTerminal(status: MatchingStatus): boolean {
  return status === "done" || status === "failed";
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Push SSE du statut (D60) : ouvert seulement pendant une analyse (`active`),
 * chaque événement invalide le matching courant (le GET reste la source de
 * vérité) ; un statut terminal arrête l'écoute, un flux fermé par le serveur
 * alors que l'analyse continue est rouvert, l'écoute est coupée au démontage.
 * Un échec d'ouverture (404/409/réseau) arrête l'écoute sans erreur visible :
 * la lecture du matching reste l'état affiché.
 */
export function useMatchingStatusStream(publicId: string, active: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!active) {
      return;
    }
    const controller = new AbortController();
    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.matching.current(publicId) });

    const listen = async () => {
      let finished = false;
      while (!controller.signal.aborted && !finished) {
        try {
          await streamMatchingStatus(
            publicId,
            (event) => {
              finished = isTerminal(event.status);
              void refresh();
            },
            controller.signal,
          );
        } catch {
          return;
        }
        if (!finished) {
          await wait(RECONNECT_DELAY_MS, controller.signal);
        }
      }
    };
    void listen();

    return () => controller.abort();
  }, [publicId, active, queryClient]);
}
