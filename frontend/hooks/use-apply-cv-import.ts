"use client";

import { useEffect, useRef } from "react";

import type { ParsedCv } from "@/types/candidate";

/**
 * Applique un import de CV au formulaire de la section au moment où il est
 * validé (nouvel objet à chaque Apply), jamais quand les données serveur
 * changent — le callback est lu dans une ref pour rester au courant sans
 * re-déclencher l'effet.
 */
export function useApplyCvImport(
  cvImport: ParsedCv | null | undefined,
  apply: (cvImport: ParsedCv) => void,
): void {
  const latestApply = useRef(apply);

  useEffect(() => {
    latestApply.current = apply;
  });

  useEffect(() => {
    if (cvImport) {
      latestApply.current(cvImport);
    }
  }, [cvImport]);
}
