/**
 * Grille de cellules clé/valeur façon fiche technique (maquette
 * `template/normalized_profile.html`) : label caps mono, valeur, sous-ligne
 * facultative. Cellules sans valeur retirées — la console tolère tout champ
 * absent (D33), jamais de tiret inventé à la place d'une donnée manquante.
 */
export type SpecCell = {
  label: string;
  value?: string | null;
  /** Sous-ligne facultative (identifiant technique, note). */
  caption?: string | null;
  /** Valeur en mono (identifiants, horodatages) — lisibilité par défaut sinon. */
  mono?: boolean;
  /** Teinte de la valeur (statut en couleur) sans recopier un badge. */
  tone?: "primary" | "success" | "error";
};

const CELL =
  "rounded-md border border-slate-border bg-item-surface/50 px-3 py-2.5 flex flex-col gap-1 min-w-0";
const CELL_LABEL =
  "font-label-caps text-label-caps uppercase tracking-wider text-text-tertiary";

const TONE_VALUE: Record<NonNullable<SpecCell["tone"]>, string> = {
  primary: "text-orange-deep",
  success: "text-success-text",
  error: "text-error",
};

export function SpecGrid({ cells }: { cells: SpecCell[] }) {
  const visible = cells.filter((cell) => cell.value);
  if (visible.length === 0) {
    return null;
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
      {visible.map((cell, index) => (
        <div key={`${cell.label}-${index}`} className={CELL}>
          <span className={CELL_LABEL}>{cell.label}</span>
          <span
            className={[
              cell.mono ? "font-mono" : "font-body-sm",
              // Wrap plutôt que troncature : les identifiants longs passent à la ligne.
              "text-body-sm font-semibold break-words",
              cell.tone ? TONE_VALUE[cell.tone] : "text-text-primary",
            ].join(" ")}
            title={cell.value ?? undefined}
          >
            {cell.value}
          </span>
          {cell.caption && (
            <span className="font-mono text-[11px] text-text-tertiary break-words">
              {cell.caption}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
