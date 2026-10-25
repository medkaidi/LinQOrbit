import { create } from "zustand";

/**
 * Rôle du champ de recherche du header sur la page courante : une page qui
 * sait chercher (job board…) déclare son rôle, le header n'est qu'un champ
 * piloté. Identité par `id` — la page passe une constante de module, jamais un
 * littéral recréé à chaque rendu.
 */
export type HeaderSearchRole = {
  id: string;
  /** Nom accessible du champ. */
  label: string;
  placeholder: string;
  maxLength?: number;
};

type HeaderSearchState = {
  role: HeaderSearchRole | null;
  query: string;
  register: (role: HeaderSearchRole) => void;
  unregister: (id: string) => void;
  setQuery: (query: string) => void;
};

/**
 * État UI pur, non persisté : la saisie meurt avec la page qui l'a demandée
 * (comme l'ancien état local de la toolbar). Sans rôle déclaré, le header
 * garde son champ d'origine, inerte.
 */
export const useHeaderSearchStore = create<HeaderSearchState>()((set) => ({
  role: null,
  query: "",
  register: (role) => set({ role, query: "" }),
  // Ne désinscrit que son propre rôle : une page qui en remplace une autre a déjà repris la main.
  unregister: (id) =>
    set((state) => (state.role?.id === id ? { role: null, query: "" } : state)),
  setQuery: (query) => set({ query }),
}));
