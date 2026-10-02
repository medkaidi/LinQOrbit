"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Vrai côté client après hydratation, faux côté serveur.
 * Remplace le couple useState + useEffect « mounted », interdit par react-hooks.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
