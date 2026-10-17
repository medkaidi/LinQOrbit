/** Enveloppe paginée D34 (page 0-based ; `size` = valeur effective décidée par le backend). */
type PageEnvelope = { page: number; size: number; total: number };

/**
 * `getNextPageParam` commun des listes infinies (D34) : page suivante tant que
 * les pages déjà servies (`page` 0-based, donc `page + 1` pages) ne couvrent
 * pas `total`, sinon `undefined` (fin de liste). L'ancienne condition
 * `page * size < total`, recopiée dans 4 hooks, demandait une page vide en
 * trop à la fin de chaque liste.
 */
export function nextPageParam(lastPage: PageEnvelope): number | undefined {
  return (lastPage.page + 1) * lastPage.size < lastPage.total ? lastPage.page + 1 : undefined;
}
