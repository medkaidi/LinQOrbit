"use client";

import { Drawer } from "@/components/ui/drawer";
import { NormalizedSheetBody } from "@/features/admin/normalized/normalized-sheet-body";
import { SHEET_HALF_WIDTH } from "@/features/admin/normalized/normalized-shared";

/**
 * Drawer de comparaison (D39) : le corps de fiche normalisée (D37, rien n'est
 * retiré — actions JSON, History, sélection de version) ouvert à droite de la
 * page détail, le source restant visible et interactif derrière. Le nom de
 * l'entité vient du détail déjà chargé par la page appelante (cache TanStack :
 * aucun fetch supplémentaire). Largeur = 50 % du contenu hors sidenav
 * (`SHEET_HALF_WIDTH`, écho du `SHEET_HALF_PAD` des pages détail).
 */
export function NormalizedSheetDrawer({
  kind,
  id,
  entityLabel,
  onClose,
}: {
  kind: "user" | "offer";
  id: string;
  entityLabel: string;
  onClose: () => void;
}) {
  return (
    <Drawer
      title="Normalized sheet"
      description={entityLabel}
      onClose={onClose}
      className={SHEET_HALF_WIDTH}
    >
      <NormalizedSheetBody kind={kind} id={id} />
    </Drawer>
  );
}
