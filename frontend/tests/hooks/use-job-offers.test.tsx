import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/hooks/query-keys";
import { useJobOfferTransition } from "@/hooks/use-job-offers";
import {
  closeJobOffer,
  publishJobOffer,
  revalidateJobOffer,
  validateJobOffer,
} from "@/lib/api/job-offer.api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/lib/api/job-offer.api", () => ({
  closeJobOffer: vi.fn(),
  createJobOffer: vi.fn(),
  deleteJobOffer: vi.fn(),
  duplicateJobOffer: vi.fn(),
  getJobOffer: vi.fn(),
  listContractTypes: vi.fn(),
  listEmploymentTypes: vi.fn(),
  listJobOffers: vi.fn(),
  listWorkModes: vi.fn(),
  publishJobOffer: vi.fn(),
  revalidateJobOffer: vi.fn(),
  updateJobOffer: vi.fn(),
  validateJobOffer: vi.fn(),
}));

const validateMock = vi.mocked(validateJobOffer);
const revalidateMock = vi.mocked(revalidateJobOffer);
const publishMock = vi.mocked(publishJobOffer);
const closeMock = vi.mocked(closeJobOffer);
const OFFER_ID = "o1";

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper };
}

function invalidatedKeys(invalidate: { mock: { calls: unknown[][] } }) {
  return invalidate.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey);
}

describe("useJobOfferTransition", () => {
  beforeEach(() => {
    for (const mock of [validateMock, revalidateMock, publishMock, closeMock]) {
      mock.mockReset();
      mock.mockResolvedValue(undefined);
    }
  });

  it.each([
    ["validate", validateMock],
    ["revalidate", revalidateMock],
    ["publish", publishMock],
    ["close", closeMock],
  ] as const)("routes %s to its own API call", async (action, expected) => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useJobOfferTransition(), { wrapper });

    await act(() => result.current.mutateAsync({ offerId: OFFER_ID, action }));

    expect(expected).toHaveBeenCalledTimes(1);
    expect(expected).toHaveBeenCalledWith(OFFER_ID);
    for (const other of [validateMock, revalidateMock, publishMock, closeMock]) {
      if (other !== expected) {
        expect(other).not.toHaveBeenCalled();
      }
    }
  });

  it("refreshes a published offer through revalidate and never falls back to close", async () => {
    // close est le repli du hook : une branche revalidate perdue fermerait l'offre publiée.
    const { wrapper } = setup();
    const { result } = renderHook(() => useJobOfferTransition(), { wrapper });

    await act(() => result.current.mutateAsync({ offerId: OFFER_ID, action: "revalidate" }));

    expect(revalidateMock).toHaveBeenCalledWith(OFFER_ID);
    expect(closeMock).not.toHaveBeenCalled();
    expect(validateMock).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it("invalidates exactly the offer list and the offer detail after a revalidate", async () => {
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useJobOfferTransition(), { wrapper });

    await act(() => result.current.mutateAsync({ offerId: OFFER_ID, action: "revalidate" }));

    expect(invalidatedKeys(invalidate)).toEqual([
      queryKeys.jobOffers.list,
      queryKeys.jobOffers.detail(OFFER_ID),
    ]);
  });

  it("invalidates nothing when the revalidate call fails", async () => {
    revalidateMock.mockRejectedValue(new Error("409"));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useJobOfferTransition(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ offerId: OFFER_ID, action: "revalidate" }),
      ).rejects.toThrow("409");
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(closeMock).not.toHaveBeenCalled();
  });
});
