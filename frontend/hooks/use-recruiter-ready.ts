"use client";

import { useCompanies } from "@/hooks/use-companies";
import { useRecruiterProfile } from "@/hooks/use-recruiter";

type RecruiterReadyState = {
  /** Profil recruteur **et** au moins une société existent : le tableau de bord a de quoi se calculer. */
  ready: boolean;
  /** Une lecture a échoué (jamais confondue avec « pas encore de profil »). */
  error: Error | null;
  refetch: () => void;
};

/**
 * Lecture seule de l'état du compte recruteur pour le tableau de bord : réutilise les requêtes
 * du profil et des sociétés (même cache que l'espace recruteur) sans rien créer ni rediriger.
 * Tant que le profil ou les sociétés manquent — ou chargent — `ready` reste faux : le tableau
 * de bord n'affiche alors rien (l'amorçage se joue dans l'espace recruteur, pas ici).
 */
export function useRecruiterReady(): RecruiterReadyState {
  const profile = useRecruiterProfile();
  const companies = useCompanies();
  const error = profile.error ?? (companies.isError ? companies.error : null);

  return {
    ready: profile.profile !== null && (companies.data?.length ?? 0) > 0,
    error,
    refetch: () => {
      if (profile.isError) {
        profile.refetch();
      }
      if (companies.isError) {
        void companies.refetch();
      }
    },
  };
}
