import type { ReactNode } from "react";

type DashboardColumnsProps = {
  /** Ce qui rend compte : chiffres, répartitions, historique. Colonne de gauche. */
  figures: ReactNode;
  /** Ce qui demande de faire quelque chose : étapes, listes de tâches. Colonne de droite. */
  actions: ReactNode;
};

/**
 * Disposition du détail des tableaux de bord candidat, recruteur et admin (D95) : **les chiffres à
 * gauche, les actions à droite**, sur les trois profils. Une carte dont les lignes rendent compte
 * (chiffre, barre, historique) va dans `figures` ; une carte dont les lignes demandent d'agir (lien
 * vers une tâche) va dans `actions`. Sous `lg` la colonne d'actions passe en premier — ce qu'il y a à
 * faire avant ce qu'il y a à lire ; l'ordre DOM reste celui de la lecture sur grand écran. Tout
 * nouveau tableau de bord passe par ce composant plutôt que par sa propre grille.
 */
export function DashboardColumns({ figures, actions }: DashboardColumnsProps) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-7 flex flex-col gap-4">{figures}</div>
      <div className="lg:col-span-5 flex flex-col gap-4 order-first lg:order-none">{actions}</div>
    </section>
  );
}
