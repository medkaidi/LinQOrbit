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

export const JOB_OFFERS_KEY = ["job-offers", "list"] as const;
export const JOB_OFFER_KEY = ["job-offers", "detail"] as const;
const OFFER_REFERENCES_STALE_TIME = 5 * 60_000;

export function useJobOffers() {
  return useQuery({
    queryKey: JOB_OFFERS_KEY,
    queryFn: listJobOffers,
    staleTime: 30_000,
  });
}

export function useJobOffer(offerId: string) {
  return useQuery({
    queryKey: [...JOB_OFFER_KEY, offerId],
    queryFn: () => getJobOffer(offerId),
    enabled: offerId !== "",
    staleTime: 30_000,
  });
}

function useInvalidateOffers() {
  const queryClient = useQueryClient();
  return (offerId?: string) => {
    void queryClient.invalidateQueries({ queryKey: JOB_OFFERS_KEY });
    if (offerId) {
      void queryClient.invalidateQueries({ queryKey: [...JOB_OFFER_KEY, offerId] });
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
    queryKey: ["job-offers", "reference", "contract-types"],
    queryFn: listContractTypes,
    staleTime: OFFER_REFERENCES_STALE_TIME,
  });
}

export function useEmploymentTypes() {
  return useQuery({
    queryKey: ["job-offers", "reference", "employment-types"],
    queryFn: listEmploymentTypes,
    staleTime: OFFER_REFERENCES_STALE_TIME,
  });
}

export function useWorkModes() {
  return useQuery({
    queryKey: ["job-offers", "reference", "work-modes"],
    queryFn: listWorkModes,
    staleTime: OFFER_REFERENCES_STALE_TIME,
  });
}
