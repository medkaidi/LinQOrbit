"use client";

import { useEffect } from "react";

import { useHeaderSearchStore, type HeaderSearchRole } from "@/stores/header-search-store";

/**
 * Donne à la page le champ de recherche du header pendant qu'elle est montée :
 * renvoie la saisie courante et son setter (« Reset » de la page = `setQuery("")`).
 * Le rôle doit être une constante de module (identité stable).
 */
export function useHeaderSearch(role: HeaderSearchRole): readonly [string, (query: string) => void] {
  const register = useHeaderSearchStore((state) => state.register);
  const unregister = useHeaderSearchStore((state) => state.unregister);
  const setQuery = useHeaderSearchStore((state) => state.setQuery);
  // Tant que le rôle n'est pas enregistré (1er rendu) ou s'il appartient à une autre page : pas de saisie.
  const query = useHeaderSearchStore((state) => (state.role?.id === role.id ? state.query : ""));

  useEffect(() => {
    register(role);
    return () => unregister(role.id);
  }, [role, register, unregister]);

  return [query, setQuery] as const;
}
