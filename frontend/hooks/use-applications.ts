"use client";

import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  discardApplication,
  getApplicationContext,
  listMyApplications,
  saveApplicationDraft,
  submitApplication,
  withdrawApplication,
} from "@/lib/api/application.api";
import { queryKeys } from "@/hooks/query-keys";
import type { SaveApplicationDraftRequest, SubmitApplicationRequest } from "@/types/application";

/** Contexte du parcours de candidature — retry coupé (offre indisponible = 404 définitif). */
export function useApplicationContext(publicId: string) {
  return useQuery({
    queryKey: queryKeys.applications.context(publicId),
    queryFn: () => getApplicationContext(publicId),
    retry: false,
  });
}

export function useMyApplications() {
  return useQuery({
    queryKey: queryKeys.applications.mine,
    queryFn: listMyApplications,
  });
}

/**
 * Après toute écriture du parcours : le contexte (étape serveur) et la liste se
 * relisent. La promesse est renvoyée à `onSuccess` : la mutation reste
 * `isPending` jusqu'à la relecture — le bouton occupé couvre le changement
 * d'étape (pas de double clic sur un écran périmé).
 */
function invalidateApplication(queryClient: QueryClient, publicId: string): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine }),
    queryClient.invalidateQueries({ queryKey: queryKeys.applications.context(publicId) }),
  ]);
}

/** Erreur 409 (course entre deux onglets…) : le contexte se relit pour rebasculer l'état. */
function refreshOnConflict(queryClient: QueryClient, publicId: string, error: unknown) {
  if (isAxiosError(error) && error.response?.status === 409) {
    queryClient.invalidateQueries({ queryKey: queryKeys.applications.context(publicId) });
  }
}

/** Enregistrement du brouillon (D59) : création au premier appel, remplacement des réponses ensuite. */
export function useSaveApplicationDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveApplicationDraftRequest) => saveApplicationDraft(body),
    onSuccess: (_data, body) => invalidateApplication(queryClient, body.jobPublicId),
    onError: (error, body) => refreshOnConflict(queryClient, body.jobPublicId, error),
  });
}

/**
 * Transmission du brouillon : le matching se ferme côté serveur, sa clé est
 * retirée. Sans brouillon encore créé (offre sans question, D59),
 * `ensureDraft` le crée d'abord — une seule mutation, un seul `isPending`.
 */
export function useSubmitApplication(publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      applicationId,
      ensureDraft,
      body,
    }: {
      applicationId: string | null;
      ensureDraft: () => Promise<string>;
      body?: SubmitApplicationRequest;
    }) => submitApplication(applicationId ?? (await ensureDraft()), body),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.matching.current(publicId) });
      return invalidateApplication(queryClient, publicId);
    },
    onError: (error) => refreshOnConflict(queryClient, publicId, error),
  });
}

/** Abandon du brouillon : le parcours repart des questions du recruteur. */
export function useDiscardApplication(publicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: string) => discardApplication(applicationId),
    onSuccess: () => invalidateApplication(queryClient, publicId),
    onError: (error) => refreshOnConflict(queryClient, publicId, error),
  });
}

export function useWithdrawApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: string) => withdrawApplication(applicationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine }),
  });
}
