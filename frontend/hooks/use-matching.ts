"use client";

import { useEffect } from "react";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  answerClarification,
  finishAssessment,
  getCurrentMatching,
  MatchingStreamError,
  saveMatchingFeedback,
  skipClarification,
  startMatching,
  streamMatchingStatus,
} from "@/lib/api/matching.api";
import { queryKeys } from "@/hooks/query-keys";
import type { AssessmentFeedbackValues } from "@/lib/validations/matching.schemas";
import type { Matching, MatchingStatus } from "@/types/matching";

/** Délai avant de rouvrir un flux fermé par le serveur (timeout) ou coupé par le réseau. */
const RECONNECT_DELAY_MS = 1_000;
/** Coupures réseau successives tolérées avant d'abandonner l'écoute (remis à zéro à chaque événement). */
const MAX_NETWORK_RETRIES = 5;

/**
 * Matching courant du couple (D58). Retry coupé : 404 = aucun matching lancé,
 * 409 = candidature transmise — réponses définitives. Pendant une analyse,
 * l'état suit tout seul via `useMatchingStatusStream` (push SSE, D60).
 */
export function useCurrentMatching(publicId: string) {
  return useQuery({
    queryKey: queryKeys.matching.current(publicId),
    queryFn: () => getCurrentMatching(publicId),
    retry: false,
  });
}

/** 409 (question déjà fermée, analyse en cours, candidature transmise…) : le matching se relit. */
function refreshMatchingOnConflict(queryClient: QueryClient, publicId: string, error: unknown) {
  if (isAxiosError(error) && error.response?.status === 409) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.matching.current(publicId) });
  }
}

/**
 * Réponse à la question IA ouverte (T-62) : le matching renvoyé (`pending`,
 * scores précédents conservés) devient le courant — le flux SSE prend le relais.
 */
export function useAnswerClarification(publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clarificationId, answer }: { clarificationId: string; answer: string }) =>
      answerClarification(publicId, clarificationId, answer),
    onSuccess: (matching) => queryClient.setQueryData(queryKeys.matching.current(publicId), matching),
    onError: (error) => refreshMatchingOnConflict(queryClient, publicId, error),
  });
}

/** Question passée (T-62) : même suite qu'une réponse. */
export function useSkipClarification(publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clarificationId: string) => skipClarification(publicId, clarificationId),
    onSuccess: (matching) => queryClient.setQueryData(queryKeys.matching.current(publicId), matching),
    onError: (error) => refreshMatchingOnConflict(queryClient, publicId, error),
  });
}

/**
 * Clôture de l'évaluation (T-62, 204) : matching et contexte du parcours (étape
 * « Candidate review ») se relisent ; la promesse est renvoyée à `onSuccess`
 * pour que `isPending` couvre la relecture.
 */
export function useFinishAssessment(publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => finishAssessment(publicId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.matching.current(publicId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.applications.context(publicId) }),
      ]),
    onError: (error) => refreshMatchingOnConflict(queryClient, publicId, error),
  });
}

/**
 * Contestation (T-63) : les items enregistrés remplacent `feedback` du matching
 * en cache (les scores ne changent jamais), puis le contexte se relit (étape
 * « Candidate review » contestée) avant de rendre la main.
 */
export function useSaveMatchingFeedback(publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: AssessmentFeedbackValues) => saveMatchingFeedback(publicId, values),
    onSuccess: (response) => {
      queryClient.setQueryData<Matching>(queryKeys.matching.current(publicId), (current) =>
        current ? { ...current, feedback: response.items } : current,
      );
      return queryClient.invalidateQueries({ queryKey: queryKeys.applications.context(publicId) });
    },
    onError: (error) => refreshMatchingOnConflict(queryClient, publicId, error),
  });
}

/**
 * L'indicateur d'étapes lit `context.assessment` (serveur) ; une évaluation peut
 * se clore **sans geste** (plafond atteint, agent sans question, à la fin d'une
 * réévaluation). Quand le matching terminé contredit le contexte, celui-ci se
 * relit — une fois par changement, jamais en boucle.
 */
export function useAssessmentStepSync(
  publicId: string,
  matching: Matching | undefined,
  contextFinished: boolean | undefined,
) {
  const queryClient = useQueryClient();
  const matchingFinished = matching?.status === "done" ? matching.assessmentFinished : undefined;

  useEffect(() => {
    if (contextFinished === undefined || matchingFinished === undefined || matchingFinished === contextFinished) {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.applications.context(publicId) });
  }, [publicId, matchingFinished, contextFinished, queryClient]);
}

/**
 * Lancement ou reprise : la réponse devient le matching courant en cache.
 * `prepare` (facultatif) s'exécute d'abord dans la même mutation — création
 * du brouillon d'une offre sans question (D59).
 */
export function useStartMatching(publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prepare?: () => Promise<unknown>) => {
      await prepare?.();
      return startMatching(publicId);
    },
    onSuccess: (matching) => queryClient.setQueryData(queryKeys.matching.current(publicId), matching),
  });
}

function isTerminal(status: MatchingStatus): boolean {
  return status === "done" || status === "failed";
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

/** Refus du serveur (404 aucun matching, 409 accès fermé, 401…) : définitif, inutile de réessayer. */
function isRefusal(error: unknown): boolean {
  return error instanceof MatchingStreamError && error.status < 500;
}

/**
 * Push SSE du statut (D60) : ouvert seulement pendant une analyse (`active`),
 * chaque événement invalide le matching courant (le GET reste la source de
 * vérité) ; un statut terminal arrête l'écoute, un flux fermé par le serveur
 * alors que l'analyse continue est rouvert, l'écoute est coupée au démontage.
 * Après tout échec, le matching est relu (le GET redevient la vérité affichée) ;
 * un refus du serveur (4xx) arrête l'écoute, une coupure réseau ou une erreur
 * serveur la reprend après {@link RECONNECT_DELAY_MS}, au plus
 * {@link MAX_NETWORK_RETRIES} fois de suite.
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
      let failures = 0;
      while (!controller.signal.aborted && !finished) {
        try {
          await streamMatchingStatus(
            publicId,
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
  }, [publicId, active, queryClient]);
}
