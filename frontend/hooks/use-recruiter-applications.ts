"use client";

import { isAxiosError } from "axios";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  decideRecruiterApplication,
  downloadRecruiterApplicationCv,
  getRecruiterApplication,
  listRecruiterApplications,
  reportCriterion,
  type CriterionReportRequest,
} from "@/lib/api/application.api";
import { queryKeys } from "@/hooks/query-keys";
import { nextPageParam } from "@/lib/utils/pagination";
import type {
  RecruiterApplicationDecision,
  RecruiterApplicationDirection,
  RecruiterApplicationSortValue,
  RecruiterApplicationStatusValue,
} from "@/types/application";

const RECRUITER_APPLICATIONS_STALE_TIME = 30_000;

/**
 * Liste infinie des candidatures d'une offre : les filtres et le tri entrent
 * dans la clé, la taille de page reste décidée par le backend.
 */
export function useRecruiterApplications(
  offerId: string,
  status: RecruiterApplicationStatusValue,
  sort: RecruiterApplicationSortValue,
  direction: RecruiterApplicationDirection,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.recruiterApplications.list(offerId, status, sort, direction),
    queryFn: ({ pageParam, signal }) =>
      listRecruiterApplications(
        offerId,
        { status, sort, direction, page: pageParam },
        { signal },
      ),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    enabled: offerId !== "",
    staleTime: RECRUITER_APPLICATIONS_STALE_TIME,
  });
}

/** Détail d'une candidature visible ; 404 définitif (brouillon, retrait, hors company). */
export function useRecruiterApplication(offerId: string, applicationId: string) {
  return useQuery({
    queryKey: queryKeys.recruiterApplications.detail(offerId, applicationId),
    queryFn: () => getRecruiterApplication(offerId, applicationId),
    enabled: offerId !== "" && applicationId !== "",
    retry: false,
    staleTime: RECRUITER_APPLICATIONS_STALE_TIME,
  });
}

/** Décision terminale : relit le détail et toutes les listes de l'offre. */
export function useDecideRecruiterApplication(offerId: string, applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decision: RecruiterApplicationDecision) =>
      decideRecruiterApplication(offerId, applicationId, decision),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.recruiterApplications.offer(offerId) }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.recruiterApplications.detail(offerId, applicationId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobOffers.dashboard }),
      ]),
    onError: (error) => {
      // 409 = course avec un autre onglet : l'état réel se relit.
      if (isAxiosError(error) && error.response?.status === 409) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.recruiterApplications.detail(offerId, applicationId),
        });
      }
    },
  });
}

/** Téléchargement du CV épinglé (blob axios + enregistrement navigateur). */
export function useDownloadRecruiterApplicationCv(offerId: string, applicationId: string) {
  return useMutation({
    mutationFn: (fileName: string) =>
      downloadRecruiterApplicationCv(offerId, applicationId, fileName),
  });
}

/**
 * Signalement interne d'une évaluation IA par critère (D66) : le signalement
 * est immuable, le détail est relu pour afficher l'état « Reported ». Un 409
 * (doublon) relit aussi le détail : l'état réel prime sur l'erreur.
 */
export function useReportCriterion(offerId: string, applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CriterionReportRequest) =>
      reportCriterion(offerId, applicationId, body),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.recruiterApplications.detail(offerId, applicationId),
      }),
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 409) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.recruiterApplications.detail(offerId, applicationId),
        });
      }
    },
  });
}
