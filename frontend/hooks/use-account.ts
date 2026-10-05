"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { me, updateProfile } from "@/lib/api/auth.api";
import { updateAbout } from "@/lib/api/candidate.api";
import type { AboutSectionValues } from "@/lib/validations/candidate.schemas";
import { PROFILE_KEY } from "@/hooks/use-candidate-profile";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/types/auth";

const ACCOUNT_KEY = ["auth", "me"] as const;

export type AccountState = {
  account: AuthUser | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

/**
 * Profil du compte : serveur d'abord, session Zustand en secours (le menu
 * utilisateur et les pages profil lisent les mêmes données).
 */
export function useAccount(): AccountState {
  const storeUser = useAuthStore((state) => state.user);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ACCOUNT_KEY,
    queryFn: me,
    staleTime: 60_000,
  });

  return {
    account: data ?? storeUser,
    isLoading,
    isError,
    refetch: () => void refetch(),
  };
}

/**
 * Sauvegarde de la section About fusionnée : champs du compte (PUT /auth/me)
 * + champs About (PUT /candidates/…/about) envoyés en parallèle. Les deux
 * clés sont invalidées quoi qu'il arrive ; l'échec d'une des deux requêtes
 * remonte en erreur sans perdre l'état du formulaire.
 */
export function useSaveAboutSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: AboutSectionValues) => {
      const { title, bio, yearsOfExperience, searchStatus, ...account } = values;
      return Promise.allSettled([
        updateProfile(account),
        updateAbout({ title, bio, yearsOfExperience, searchStatus }),
      ]).then((results) => {
        const failure = results.find((result) => result.status === "rejected");
        if (failure) {
          throw (failure as PromiseRejectedResult).reason;
        }
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ACCOUNT_KEY });
      void queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });
}
