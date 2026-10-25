import type { ReactNode } from "react";

import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";

export type StatusBreakdownRow = {
  id: string;
  /** Pastille de statut (la famille de l'appelant : offre, candidature, compte…). */
  pill: ReactNode;
  /** Valeur déjà formatée : le chiffre, ou « — » quand la source manque. */
  value: string;
  /** Nombre brut de la ligne ; absent tant que la source manque. Sert à la barre de proportion. */
  amount?: number;
  /** Couleur de la barre (`bg-*`) : le point de la pastille de la ligne, jamais une couleur nouvelle. */
  barClass?: string;
};

type StatusBreakdownCardProps = {
  title: string;
  /** Total en texte muet à droite du titre (« 12 offers ») ; absent tant que la source manque. */
  summary?: string | null;
  rows: StatusBreakdownRow[];
};

/** Largeur plancher d'une barre non vide : une petite part reste visible sans mentir sur l'ordre de grandeur. */
const MIN_BAR_PERCENT = 4;

/** Part de la ligne dans le total, en pourcentage ; 0 quand rien n'est compté (jamais de division par zéro). */
function barPercent(amount: number, total: number): number {
  if (amount <= 0 || total <= 0) {
    return 0;
  }
  return Math.max(MIN_BAR_PERCENT, (amount / total) * 100);
}

/**
 * Carte « répartition par statut » des tableaux de bord : une ligne pastille + valeur par statut.
 * Gabarit unique des vues candidat (pipeline de candidatures), recruteur (offres) et admin
 * (offres, comptes, échecs de traitement). L'appelant fournit les pastilles et formate les valeurs.
 *
 * Quand **toutes** les lignes portent un `amount` et un `barClass`, chaque ligne montre sa part du
 * total en barre horizontale (décorative : le chiffre en porte déjà l'information). Dès qu'une source
 * manque (chargement, échec) ou que les lignes ne sont pas les parts d'un tout (échecs IA), aucune
 * barre n'est dessinée — jamais une proportion inventée.
 */
export function StatusBreakdownCard({ title, summary, rows }: StatusBreakdownCardProps) {
  const charted = rows.length > 0 && rows.every((row) => row.amount !== undefined && row.barClass !== undefined);
  const total = charted ? rows.reduce((sum, row) => sum + (row.amount ?? 0), 0) : 0;

  return (
    <section className={SECTION_CARD_CLASS} aria-label={title}>
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
        {summary ? <span className={MUTED_TEXT_CLASS}>{summary}</span> : null}
      </header>
      <dl className="px-6 pt-4 pb-5 flex flex-col divide-y divide-slate-border">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="shrink-0">{row.pill}</dt>
            {charted ? (
              <div
                data-testid="breakdown-track"
                aria-hidden="true"
                className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-surface"
              >
                <div
                  data-testid="breakdown-bar"
                  className={`h-full rounded-full ${row.barClass}`}
                  style={{ width: `${barPercent(row.amount ?? 0, total)}%` }}
                />
              </div>
            ) : (
              <span className="flex-1" aria-hidden="true" />
            )}
            <dd className="shrink-0 font-label-lg text-label-lg font-bold text-text-primary">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
