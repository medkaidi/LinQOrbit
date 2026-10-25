import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

type StatCardProps = {
  /** Rubrique en tête de carte (« Profile », « Applications »…). */
  section: string;
  /** Période ou fraîcheur du chiffre, en mono à droite de la rubrique. */
  period: string;
  value: string;
  caption: string;
  /** Titre du bandeau coloré du bas. */
  bandTitle: string;
  /** Ligne de contexte sous le titre du bandeau. */
  bandTrend: string;
  bandIcon: string;
  /** Fond du bandeau (couleur de la plateforme : `bg-orange-deep`, `bg-blue-deep`…). */
  bandClass: string;
};

/**
 * Carte de métrique du tableau de bord : chiffre central sous une rubrique,
 * bandeau coloré en pied. Gabarit unique des vues candidat et recruteur.
 */
export function StatCard({
  section,
  period,
  value,
  caption,
  bandTitle,
  bandTrend,
  bandIcon,
  bandClass,
}: StatCardProps) {
  return (
    <div className="bg-canvas-white border border-slate-border rounded-2xl overflow-hidden flex flex-col justify-between hover:border-slate-border-strong transition-[border-color] duration-150 ease-out">
      <div className="p-4 pb-3 flex flex-col flex-1">
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-border">
          <span className="text-body-sm font-body-sm font-medium text-text-secondary">
            {section}
          </span>
          <span className="text-[11px] font-mono text-text-tertiary">{period}</span>
        </div>
        <div className="my-auto text-center py-1">
          <div className="text-display-mobile font-display font-extrabold text-text-primary leading-none">
            {value}
          </div>
          <div className="mt-1.5 text-body-sm font-body-sm text-text-tertiary font-medium">
            {caption}
          </div>
        </div>
      </div>
      <div
        className={cn(
          "px-3.5 py-2.5 text-canvas-white flex items-center justify-between mt-2",
          bandClass,
        )}
      >
        <div className="flex flex-col text-left leading-tight">
          <span className="font-label-caps text-label-caps uppercase">{bandTitle}</span>
          <span className="text-[10px] text-canvas-white/90 font-medium">{bandTrend}</span>
        </div>
        <div className="w-5 h-5 rounded flex items-center justify-center border border-canvas-white/40 bg-canvas-white/20 shrink-0 ml-2">
          <Icon name={bandIcon} className="text-[14px] text-canvas-white" />
        </div>
      </div>
    </div>
  );
}
