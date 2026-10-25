"use client";

import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/hooks/query-keys";
import { useStatusStream } from "@/hooks/use-status-stream";
import {
  getSuggestedCandidateProfile,
  inviteSuggestedCandidate,
  listMyInvitations,
  listSuggestedCandidates,
  retryScreening,
  streamScreeningStatus,
} from "@/lib/api/invitation.api";
import type { ScreeningStatusEvent } from "@/types/invitation";

/**
 * Candidats suggérés d'une offre : `enabled` seulement quand la recherche est
 * terminée (`done`) — la liste est un instantané figé, sans relecture
 * automatique ; retry coupé (offre non publiée = 409 définitif).
 */
export function useSuggestedCandidates(offerId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.recruiterSuggestions.list(offerId),
    queryFn: () => listSuggestedCandidates(offerId),
    enabled: enabled && offerId !== "",
    retry: false,
  });
}

/**
 * Profil complet d'un candidat suggéré (T-102, D86). Pas de nouvelle tentative :
 * 404 (consentement retiré) et 409 (offre fermée) sont définitifs.
 */
export function useSuggestedCandidateProfile(offerId: string, suggestionId: string) {
  return useQuery({
    queryKey: queryKeys.recruiterSuggestions.profile(offerId, suggestionId),
    queryFn: () => getSuggestedCandidateProfile(offerId, suggestionId),
    enabled: offerId !== "" && suggestionId !== "",
    retry: false,
  });
}

/**
 * Invitation d'un candidat suggéré : la liste **et** les profils de l'offre se
 * relisent au succès, ainsi que sur 409 (déjà invité, a candidaté entre-temps)
 * et 404 (consentement retiré) — l'état réel prime sur l'erreur.
 */
export function useInviteCandidate(offerId: string) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.recruiterSuggestions.offer(offerId) });
  return useMutation({
    mutationFn: (suggestionId: string) => inviteSuggestedCandidate(offerId, suggestionId),
    onSuccess: refresh,
    onError: (error) => {
      if (isAxiosError(error) && [404, 409].includes(error.response?.status ?? 0)) {
        void refresh();
      }
    },
  });
}

/** Invitations du candidat connecté, les plus récentes d'abord (serveur). */
export function useMyInvitations() {
  return useQuery({
    queryKey: queryKeys.invitations.mine,
    queryFn: listMyInvitations,
  });
}

/** Relit l'offre (détail + liste) : le signal `screening` est porté par le GET de l'offre. */
function useRefreshOffer(offerId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.jobOffers.list }),
      queryClient.invalidateQueries({ queryKey: queryKeys.jobOffers.detail(offerId) }),
    ]);
}

/**
 * Relance manuelle de la recherche (uniquement après un échec) : l'offre se
 * relit au succès et sur 409 (le statut réel a changé entre-temps).
 */
export function useRetryScreening(offerId: string) {
  const refresh = useRefreshOffer(offerId);
  return useMutation({
    mutationFn: () => retryScreening(offerId),
    onSuccess: refresh,
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 409) {
        void refresh();
      }
    },
  });
}

/**
 * Push SSE du statut de screening : **un** flux par offre, ouvert seulement
 * pendant la recherche (`active` = `pending`/`running`). Chaque événement
 * relit l'offre (le GET reste la vérité affichée) ; un statut terminal
 * (`done`, `failed`, `none`) arrête l'écoute. Mécanique de
 * {@link useStatusStream} (reconnexion bornée, arrêt sur refus 4xx).
 */
export function useScreeningStream(offerId: string, active: boolean) {
  const refresh = useRefreshOffer(offerId);
  useStatusStream<ScreeningStatusEvent>({
    active,
    streamKey: `screening:${offerId}`,
    stream: (onStatus, signal) => streamScreeningStatus(offerId, onStatus, signal),
    isTerminal: (event) => event.status !== "pending" && event.status !== "running",
    refresh,
  });
}
