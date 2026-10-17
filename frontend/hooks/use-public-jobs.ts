"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { listPublicJobs } from "@/lib/api/public-jobs.api";
import { queryKeys } from "@/hooks/query-keys";

/**
 * Job board public (T-72) : offres publiées en infinite scroll — la taille
 * de page reste décidée par le backend (D34, jamais envoyée).
 */
export function useInfinitePublicJobs() {
  return useInfiniteQuery({
    queryKey: queryKeys.publicJobs.list,
    queryFn: ({ pageParam, signal }) => listPublicJobs({ page: pageParam }, { signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.size < lastPage.total ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
  });
}
