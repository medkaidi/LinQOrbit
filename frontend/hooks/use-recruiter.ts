"use client";

import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createRecruiter as createRecruiterApi,
  getRecruiter,
  updateRecruiter,
} from "@/lib/api/recruiter.api";
import type { UpdateRecruiterValues } from "@/lib/validations/recruiter.schemas";
import type { RecruiterProfile } from "@/types/recruiter";
import { queryKeys } from "@/hooks/query-keys";

export type RecruiterProfileState = {
  /** `null` = aucun profil recruteur (404) — déclenche l'onboarding D16. */
  profile: RecruiterProfile | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
};

/**
 * Profil recruteur : 404 = pas de profil (normal pendant l'onboarding, pas une
 * erreur) — l'espace recruteur affiche alors le dialog d'essai (D16).
 * `enabled: false` évite l'appel (ex. menu user en mode candidat).
 */
export function useRecruiterProfile(options?: { enabled?: boolean }): RecruiterProfileState {
  const enabled = options?.enabled ?? true;
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.recruiter.profile,
    queryFn: async () => {
      try {
        return await getRecruiter();
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 30_000,
    enabled,
  });

  return {
    profile: data ?? null,
    isLoading,
    isError,
    error: isError ? error : null,
    refetch: () => void refetch(),
  };
}

export function useCreateRecruiter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createRecruiterApi(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruiter.profile });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
    // 409 : le profil existe déjà (créé entre-temps) — on refait le GET plutôt
    // que d'afficher une erreur bloquante.
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 409) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.recruiter.profile });
      }
    },
  });
}

export function useUpdateRecruiter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: UpdateRecruiterValues) => updateRecruiter(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruiter.profile });
    },
  });
}
