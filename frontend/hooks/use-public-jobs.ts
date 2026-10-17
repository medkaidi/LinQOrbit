"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { getPublicJob, getRelatedPublicJobs, listPublicJobs } from "@/lib/api/public-jobs.api";
import { queryKeys } from "@/hooks/query-keys";
import { nextPageParam } from "@/lib/utils/pagination";

/**
 * Job board public (T-72) : offres publiées en infinite scroll — la taille
 * de page reste décidée par le backend (D34, jamais envoyée).
 */
export function useInfinitePublicJobs() {
  return useInfiniteQuery({
    queryKey: queryKeys.publicJobs.list,
    queryFn: ({ pageParam, signal }) => listPublicJobs({ page: pageParam }, { signal }),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
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

/**
 * Fiche publique d'une offre (`GET /api/v1/jobs/{publicId}`) : pas de
 * retry — un 404 (offre inconnue, non publiée ou expirée) est une réponse
 * définitive, la vue rend aussitôt « Job not found » (TD-049).
 */
export function usePublicJob(publicId: string) {
  return useQuery({
    queryKey: queryKeys.publicJobs.detail(publicId),
    queryFn: () => getPublicJob(publicId),
    retry: false,
  });
}
