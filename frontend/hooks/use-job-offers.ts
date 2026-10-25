"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import {
  closeJobOffer,
  createJobOffer,
  deleteJobOffer,
  duplicateJobOffer,
  getJobOffer,
  getRecruiterDashboard,
  listContractTypes,
  listEmploymentTypes,
  listJobOffers,
  listWorkModes,
  publishJobOffer,
  revalidateJobOffer,
  updateJobOffer,
  validateJobOffer,
} from "@/lib/api/job-offer.api";
import type {
  CreateJobOfferValues,
  UpdateJobOfferValues,
} from "@/lib/validations/job-offer.schemas";
import { queryKeys } from "@/hooks/query-keys";
import { nextPageParam } from "@/lib/utils/pagination";
import type { JobOfferFilters } from "@/types/recruiter";

const OFFER_REFERENCES_STALE_TIME = 5 * 60_000;

/**
 * Offres des companies du recruteur en infinite scroll (D34) : la taille de
 * page reste décidée par le backend (jamais envoyée). Les filtres (T-70)
 * entrent dans la clé ; l'ancienne liste reste affichée pendant qu'une
 * nouvelle combinaison se charge (la toolbar ne clignote pas).
 */
export function useInfiniteJobOffers(filters: JobOfferFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.jobOffers.page(filters),
    queryFn: ({ pageParam, signal }) =>
      listJobOffers({ ...filters, page: pageParam }, { signal }),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Chiffres du tableau de bord recruteur. `enabled` = profil et société existent :
 * sans eux l'endpoint répond 404 et le dashboard n'affiche rien (jamais d'appel de bruit).
 */
export function useRecruiterDashboard({ enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: queryKeys.jobOffers.dashboard,
    queryFn: getRecruiterDashboard,
    staleTime: 30_000,
    enabled,
  });
}

export function useJobOffer(offerId: string) {
  return useQuery({
    queryKey: queryKeys.jobOffers.detail(offerId),
    queryFn: () => getJobOffer(offerId),
    enabled: offerId !== "",
    staleTime: 30_000,
  });
}

function useInvalidateOffers() {
  const queryClient = useQueryClient();
  return (offerId?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobOffers.list });
    if (offerId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobOffers.detail(offerId) });
    }
  };
}

export function useCreateJobOffer() {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: (values: CreateJobOfferValues) => createJobOffer(values),
    onSuccess: (offer) => invalidate(offer.id),
  });
}

export function useUpdateJobOffer() {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: ({
      offerId,
      values,
    }: {
      offerId: string;
      values: UpdateJobOfferValues;
    }) => updateJobOffer(offerId, values),
    onSuccess: (_data, { offerId }) => invalidate(offerId),
  });
}

export function useDeleteJobOffer() {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: (offerId: string) => deleteJobOffer(offerId),
    onSuccess: (_data, offerId) => invalidate(offerId),
  });
}

/** Duplication (D20) : la copie naît en DRAFT — navigation vers son édition. */
export function useDuplicateJobOffer() {
  const invalidate = useInvalidateOffers();
  const router = useRouter();
  return useMutation({
    mutationFn: (offerId: string) => duplicateJobOffer(offerId),
    onSuccess: (offer) => {
      invalidate(offer.id);
      router.push(`/recruiter/offers/${offer.id}/edit`);
    },
  });
}

/** Transitions D13 : validate ≠ publish ; close depuis validated ou published. */
export function useJobOfferTransition() {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: ({
      offerId,
      action,
    }: {
      offerId: string;
      action: "validate" | "revalidate" | "publish" | "close";
    }) => {
      if (action === "validate") {
        return validateJobOffer(offerId);
      }
      if (action === "revalidate") {
        return revalidateJobOffer(offerId);
      }
      if (action === "publish") {
        return publishJobOffer(offerId);
      }
      return closeJobOffer(offerId);
    },
    onSuccess: (_data, { offerId }) => invalidate(offerId),
  });
}

export function useContractTypes() {
  return useQuery({
    queryKey: queryKeys.jobOffers.contractTypes,
    queryFn: listContractTypes,
    staleTime: OFFER_REFERENCES_STALE_TIME,
  });
}

export function useEmploymentTypes() {
  return useQuery({
    queryKey: queryKeys.jobOffers.employmentTypes,
    queryFn: listEmploymentTypes,
    staleTime: OFFER_REFERENCES_STALE_TIME,
  });
}

export function useWorkModes() {
  return useQuery({
    queryKey: queryKeys.jobOffers.workModes,
    queryFn: listWorkModes,
    staleTime: OFFER_REFERENCES_STALE_TIME,
  });
}
