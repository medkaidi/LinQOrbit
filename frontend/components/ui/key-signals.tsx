import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

const NOT_PROVIDED = "Not provided";

export type KeySignal = {
  icon: string;
  label: string;
  /** `null` = donnée absente : affichée « Not provided » estompé, la cellule reste. */
  value: string | null;
};

/** « 1 year » / « 9 years » — formulation commune des cartes de candidat. */
export function yearsLabel(years: number): string {
  return years === 1 ? "1 year" : `${years} years`;
}

/** Cellule de la bande : libellé à icône, valeur (ou « Not provided » estompé). */
function Signal({ icon, label, value }: KeySignal) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-3 first:pl-1 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-slate-border">
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
        <Icon name={icon} className="text-[13px]" />
        {label}
      </span>
      <span
        title={value ?? undefined}
        className={cn(
          "truncate text-body-sm font-body-sm",
          value ? "font-semibold text-text-primary" : "text-text-tertiary",
        )}
      >
        {value ?? NOT_PROVIDED}
      </span>
    </div>
  );
}

/**
 * Bande de trois signaux d'une carte de candidat (maquette `screening_candidates`) :
 * toujours trois cellules, pour que les cartes d'une même rangée restent alignées.
 * Partagée par les candidats suggérés et les candidatures d'une offre.
 */
export function KeySignals({ signals }: { signals: [KeySignal, KeySignal, KeySignal] }) {
  return (
    <div
      aria-label="Key facts"
      className="grid grid-cols-3 rounded-2xl border border-slate-border bg-item-surface p-3"
    >
      {signals.map((signal) => (
        <Signal key={signal.label} {...signal} />
      ))}
    </div>
  );
}
