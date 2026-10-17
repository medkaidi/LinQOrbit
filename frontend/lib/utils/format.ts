/** Formatages d'affichage partagés (tailles, dates courtes, pluriels). */

/** Octets → « 240 B », « 234 KB », « 1.2 MB » (arrondi au KB, 1 décimale au MB). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

/**
 * Date ISO → « 16 Oct 2026 » (locale anglaise, format court). Une entrée
 * illisible est renvoyée telle quelle plutôt que « Invalid Date ».
 */
export function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

/** « 1 skill » / « 2 skills » / « 3 entries » (pluriel régulier + règle y → ies). */
export function plural(count: number, noun: string): string {
  const pluralForm = noun.endsWith("y") ? `${noun.slice(0, -1)}ies` : `${noun}s`;
  return `${count} ${count > 1 ? pluralForm : noun}`;
}
