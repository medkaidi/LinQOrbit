/**
 * Pills / chips neutres — une seule surface (bord fin, fond item, typo
 * body-sm) pour tous les sites qui la recopiaient (TD-043). `cn()` est une
 * simple jointure (pas de fusion Tailwind) : les variantes de padding et de
 * couleur sont donc des constantes complètes, jamais des surcharges.
 */
const PILL_SURFACE =
  "rounded-full border border-slate-border bg-item-surface/50 py-1 font-body-sm text-body-sm";

/** Pill texte neutre (exigences, diplômes, langues des fiches admin). */
export const NEUTRAL_PILL_CLASS = `${PILL_SURFACE} px-3 text-text-primary`;

/** Variante atténuée (compétences des cartes du job board). */
export const MUTED_PILL_CLASS = `${PILL_SURFACE} px-3 text-text-secondary`;

/** Pill texte + pastille annexe en ligne (langue + badge d'origine). */
export const INLINE_PILL_CLASS = `flex items-center gap-2 ${NEUTRAL_PILL_CLASS}`;

/** Chip méta compacte (icône + libellé) des cartes et de la fiche d'offre. */
export const META_CHIP_CLASS = `inline-flex items-center gap-1 ${PILL_SURFACE} px-2.5 text-text-secondary`;

/** Chip méta signalée (échéance urgente). */
export const META_CHIP_URGENT_CLASS =
  "inline-flex items-center gap-1 rounded-full border border-orange-border bg-orange-subtle px-2.5 py-1 font-body-sm text-body-sm font-semibold text-orange-deep";
