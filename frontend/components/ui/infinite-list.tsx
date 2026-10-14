"use client";

import { Fragment, useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export type InfiniteListProps<T> = {
  items: T[];
  keyExtractor: (item: T) => string;
  /** Rend l'`<li>` de l'élément (structure et classes de la ligne). */
  renderItem: (item: T) => ReactNode;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /** Première page en cours de chargement (la liste reste alors silencieuse). */
  loading?: boolean;
  /** Message affiché quand la liste est vide, hors chargement. */
  empty?: ReactNode;
  loadMoreLabel?: string;
};

/**
 * Liste paginée en infinite scroll (D34) : le sentinel observe l'arrivée en
 * bas de zone et déclenche `fetchNextPage` ; le bouton « Load more » reste un
 * repli accessible (focus clavier), désactivé pendant le fetch de page.
 */
export function InfiniteList<T>({
  items,
  keyExtractor,
  renderItem,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  loading = false,
  empty,
  loadMoreLabel = "Load more",
}: InfiniteListProps<T>) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const canFetch = hasNextPage && !isFetchingNextPage;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !canFetch || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canFetch, fetchNextPage]);

  if (items.length === 0) {
    if (loading || !empty) {
      return null;
    }
    return <>{empty}</>;
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <Fragment key={keyExtractor(item)}>{renderItem(item)}</Fragment>
        ))}
      </ul>
      <div ref={sentinelRef} className="h-px" />
      {isFetchingNextPage ? (
        <p className="flex items-center gap-2 text-body-sm text-text-secondary pt-3">
          <Spinner className="text-[16px]" />
          Loading more…
        </p>
      ) : null}
      {hasNextPage ? (
        <div className="pt-3">
          <Button
            variant="outline-sm"
            className="sr-only focus:not-sr-only"
            disabled={isFetchingNextPage}
            onClick={fetchNextPage}
          >
            {loadMoreLabel}
          </Button>
        </div>
      ) : null}
    </>
  );
}
