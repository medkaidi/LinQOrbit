"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { listPublicJobs, getRelatedPublicJobs } from "@/lib/api/public-jobs.api";
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

/**
 * « More from this company » de la fiche publique (T-74) : endpoint dédié
 * `GET /api/v1/jobs/{publicId}/related` — les autres offres publiées non
 * expirées de la même entreprise, tri et limite décidés par le backend.
 * `enabled` n'ouvre la requête qu'une fois la fiche chargée (inutile en 404).
 */
export function useRelatedPublicJobs(publicId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.publicJobs.related(publicId),
    queryFn: ({ signal }) => getRelatedPublicJobs(publicId, { signal }),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}
