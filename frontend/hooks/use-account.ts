"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { me, updateProfile, type AuthUser } from "@/lib/api/auth.api";
import type { UpdateProfileValues } from "@/lib/validations/auth.schemas";
import { useAuthStore } from "@/stores/auth-store";

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

/** Mise à jour de l'identité : invalide le compte pour rafraîchir cartes et pages. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: UpdateProfileValues) => updateProfile(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCOUNT_KEY }),
  });
}
