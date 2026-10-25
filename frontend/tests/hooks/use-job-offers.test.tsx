import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/hooks/query-keys";
import { useInfiniteJobOffers, useJobOfferTransition, useRecruiterDashboard } from "@/hooks/use-job-offers";
import {
  closeJobOffer,
  getRecruiterDashboard,
  listJobOffers,
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
  getRecruiterDashboard: vi.fn(),
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

describe("useInfiniteJobOffers — filters (T-70)", () => {
  const listMock = vi.mocked(listJobOffers);
  const emptyPage = { items: [], page: 0, size: 20, total: 0 };

  beforeEach(() => {
    listMock.mockReset();
    listMock.mockResolvedValue(emptyPage);
  });

  it("sends the filters with the page, and only the page without filters", async () => {
    const { wrapper } = setup();

    const filtered = renderHook(
      () => useInfiniteJobOffers({ q: "backend", status: "published", expiry: "expired" }),
      { wrapper },
    );
    await waitFor(() => expect(filtered.result.current.isSuccess).toBe(true));
    expect(listMock).toHaveBeenLastCalledWith(
      { q: "backend", status: "published", expiry: "expired", page: 0 },
      expect.anything(),
    );

    const unfiltered = renderHook(() => useInfiniteJobOffers(), { wrapper });
    await waitFor(() => expect(unfiltered.result.current.isSuccess).toBe(true));
    expect(listMock).toHaveBeenLastCalledWith({ page: 0 }, expect.anything());
  });

  it("keeps the previous list while a new filter combination loads", async () => {
    const previous = { ...emptyPage, total: 1, items: [{ id: "o1" } as never] };
    let release: (value: typeof emptyPage) => void = () => {};
    listMock
      .mockResolvedValueOnce(previous)
      .mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    const { wrapper } = setup();

    const { result, rerender } = renderHook(
      ({ q }: { q?: string }) => useInfiniteJobOffers(q ? { q } : {}),
      { wrapper, initialProps: {} as { q?: string } },
    );
    await waitFor(() => expect(result.current.data?.pages[0].items).toHaveLength(1));

    rerender({ q: "devops" });

    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data?.pages[0].items).toHaveLength(1);

    await act(async () => release(emptyPage));
    await waitFor(() => expect(result.current.data?.pages[0].items).toHaveLength(0));
  });

  it("is refetched by the root list key, which every offer mutation invalidates", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useInfiniteJobOffers({ q: "backend" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listMock).toHaveBeenCalledTimes(1);

    await act(() => client.invalidateQueries({ queryKey: queryKeys.jobOffers.list }));

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });
});

describe("useRecruiterDashboard", () => {
  const dashboardMock = vi.mocked(getRecruiterDashboard);
  const body = {
    offers: { draft: 0, validated: 0, published: 1, closed: 0 },
    liveOffers: 1,
    closingSoon: { count: 0, nextExpiry: null },
    applications: { toReview: 0, accepted: 0, rejected: 0 },
    candidates: { toInvite: 0, invited: 0, searchesFailed: 0 },
    attention: [],
  };

  beforeEach(() => {
    dashboardMock.mockReset();
    dashboardMock.mockResolvedValue(body);
  });

  it("never calls the endpoint while disabled, then loads once enabled", async () => {
    const { wrapper } = setup();

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useRecruiterDashboard({ enabled }),
      { wrapper, initialProps: { enabled: false } },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(dashboardMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.data).toEqual(body));
    expect(dashboardMock).toHaveBeenCalledTimes(1);
  });

  it("sits under the offer list key, so every offer mutation refreshes it", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRecruiterDashboard({ enabled: true }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryKeys.jobOffers.dashboard.slice(0, queryKeys.jobOffers.list.length)).toEqual(
      queryKeys.jobOffers.list,
    );

    await act(() => client.invalidateQueries({ queryKey: queryKeys.jobOffers.list }));

    await waitFor(() => expect(dashboardMock).toHaveBeenCalledTimes(2));
  });
});
