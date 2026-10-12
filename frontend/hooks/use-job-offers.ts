"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  closeJobOffer,
  createJobOffer,
  deleteJobOffer,
  getJobOffer,
  listContractTypes,
  listEmploymentTypes,
  listJobOffers,
  listWorkModes,
  publishJobOffer,
  updateJobOffer,
  validateJobOffer,
} from "@/lib/api/job-offer.api";
import type {
  CreateJobOfferValues,
  UpdateJobOfferValues,
} from "@/lib/validations/job-offer.schemas";
import { queryKeys } from "@/hooks/query-keys";

const OFFER_REFERENCES_STALE_TIME = 5 * 60_000;

export function useJobOffers() {
  return useQuery({
    queryKey: queryKeys.jobOffers.list,
    queryFn: listJobOffers,
    staleTime: 30_000,
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

/** Transitions D13 : validate ≠ publish ; close depuis validated ou published. */
export function useJobOfferTransition() {
  const invalidate = useInvalidateOffers();
  return useMutation({
    mutationFn: ({
      offerId,
      action,
    }: {
      offerId: string;
      action: "validate" | "publish" | "close";
    }) => {
      if (action === "validate") {
        return validateJobOffer(offerId);
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
