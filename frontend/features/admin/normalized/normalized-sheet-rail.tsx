import { Icon } from "@/components/ui/icon";
import type { SheetStats } from "@/features/admin/normalized/normalized-shared";

const WIDGET =
  "rounded-md border border-slate-border bg-item-surface/50 p-3 flex flex-col gap-3";
const WIDGET_HEADER =
  "flex items-center gap-2 pb-3 border-b border-slate-border";
const WIDGET_TITLE =
  "font-headline-sm text-headline-sm text-text-primary tracking-tight";

/**
 * Rail latéral de la fiche (colonne droite) : uniquement des données réelles
 * du contenu — provenance declared/inferred et couverture des sections. Les
 * widgets fiction de la maquette (confiance, entropie, affinité matching,
 * passerelle offre) n'existent pas ici : aucune donnée inventée.
 */
export function NormalizedSheetRail({ stats }: { stats: SheetStats }) {
  const { provenance, coverage } = stats;
  const filled = coverage.filter((section) => section.count > 0).length;
  const declaredPct =
    provenance.total > 0 ? Math.round((provenance.declared / provenance.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <section className={WIDGET} aria-label="Provenance">
        <header className={WIDGET_HEADER}>
          <Icon name="troubleshoot" className="text-[18px] text-orange-deep" />
          <h4 className={WIDGET_TITLE}>Provenance</h4>
        </header>
        {provenance.total === 0 ? (
          <p className="text-body-sm font-body-sm text-text-secondary">
            No origin data on this sheet yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-slate-border bg-canvas-white p-2.5">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary block">
                  Declared
                </span>
                <span className="font-mono text-label-lg font-bold text-text-primary mt-1 block">
                  {provenance.declared}
                </span>
              </div>
              <div className="rounded-md border border-slate-border bg-canvas-white p-2.5">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary block">
                  Inferred
                </span>
                <span className="font-mono text-label-lg font-bold text-text-primary mt-1 block">
                  {provenance.inferred}
                </span>
              </div>
            </div>
            <div>
              <div
                role="progressbar"
                aria-label="Share of declared entries"
                aria-valuenow={declaredPct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="w-full h-2 rounded-full bg-slate-surface overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-primary-container"
                  style={{ width: `${declaredPct}%` }}
                />
              </div>
              <p className="text-body-sm font-body-sm text-text-secondary mt-1.5">
                {declaredPct}% declared
              </p>
            </div>
          </>
        )}
      </section>

      <section className={WIDGET} aria-label="Sheet coverage">
        <header className={WIDGET_HEADER}>
          <Icon name="fact_check" className="text-[18px] text-blue-deep" />
          <h4 className={WIDGET_TITLE}>Sheet coverage</h4>
          <span className="ml-auto font-mono text-label-md font-bold text-text-secondary">
            {filled}/{coverage.length}
          </span>
        </header>
        <ul className="divide-y divide-slate-border">
          {coverage.map((section) => (
            <li
              key={section.label}
              className="flex items-center justify-between gap-3 py-2 text-body-sm font-body-sm"
            >
              <span className="text-text-secondary">{section.label}</span>
              {section.count > 0 ? (
                <span className="font-mono font-semibold text-text-primary">
                  {section.count}
                </span>
              ) : (
                <span className="text-text-tertiary">—</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
