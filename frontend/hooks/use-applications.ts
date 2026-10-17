"use client";

import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getApplicationContext,
  listMyApplications,
  submitApplication,
  withdrawApplication,
} from "@/lib/api/application.api";
import { queryKeys } from "@/hooks/query-keys";
import type { SubmitApplicationRequest } from "@/types/application";

/** Contexte de candidature d'une offre publiée — retry coupé (indisponible = 404 définitif). */
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

export function useSubmitApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitApplicationRequest) => submitApplication(body),
    onSuccess: (_data, body) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine });
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.context(body.jobPublicId) });
    },
    onError: (error, body) => {
      // Doublon (course entre deux onglets…) : rafraîchit le contexte pour basculer
      // le formulaire sur l'état « déjà candidaté ».
      if (isAxiosError(error) && error.response?.status === 409) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.applications.context(body.jobPublicId),
        });
      }
    },
  });
}

export function useWithdrawApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: string) => withdrawApplication(applicationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine }),
  });
}
