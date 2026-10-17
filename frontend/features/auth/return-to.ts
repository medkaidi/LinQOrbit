/**
 * Paramètre `?next=` des pages auth : n'accepte qu'un chemin interne au site
 * (commence par `/`, jamais `//` ni `\` — pas d'open redirect). Toute autre
 * valeur → null (retour au dashboard par défaut).
 */
export function safeReturnTo(raw: string | string[] | undefined | null): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return null;
  }
  if (raw.includes("\\")) {
    return null;
  }
  return raw;
}
