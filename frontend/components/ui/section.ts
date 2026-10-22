/**
 * Anatomie partagée des sections en carte blanche (formulaires, listes,
 * candidatures, console admin) — une seule définition au lieu des copies
 * par feature (TD-031).
 */
export const SECTION_CARD_CLASS = "bg-canvas-white rounded-2xl shadow-sm";
export const SECTION_HEADER_CLASS =
  "mx-6 pt-4 pb-4 flex items-start justify-between gap-4 border-b border-slate-border";
export const SECTION_TITLE_CLASS =
  "font-headline-md text-headline-md text-text-primary font-bold tracking-tight min-w-0";
export const ITEM_CARD_CLASS = "rounded-2xl border border-slate-border bg-item-surface/50 p-4";
/**
 * Variante « plate » de l'item : rayon `rounded-lg` au lieu de `rounded-2xl`.
 * Réservée aux pages où plusieurs blocs s'emboîtent et doivent **partager le
 * même degré d'arrondi** (parent et enfant) — détail recruteur : items,
 * panneau de contestation et bloc « Why the AI asked this ».
 */
export const ITEM_CARD_FLAT_CLASS =
  "rounded-lg border border-slate-border bg-item-surface/50 p-4";
export const MUTED_TEXT_CLASS = "text-body-sm font-body-sm text-text-secondary";
