import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/hooks/query-keys";
import {
  useCandidateNormalizationStream,
  useOfferNormalizationStream,
} from "@/hooks/use-normalization-stream";
import { NormalizationStreamError, streamNormalizationStatus } from "@/lib/api/normalization.api";

vi.mock("@/lib/api/normalization.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/normalization.api")>();
  return {
    NormalizationStreamError: actual.NormalizationStreamError,
    streamNormalizationStatus: vi.fn(),
  };
});

const streamMock = vi.mocked(streamNormalizationStatus);

function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function invalidatedKeys(invalidate: { mock: { calls: unknown[][] } }) {
  return invalidate.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey);
}

describe("use-normalization-stream", () => {
  beforeEach(() => {
    streamMock.mockReset();
  });

  it("never opens a stream while no analysis is in progress", () => {
    renderHook(() => useCandidateNormalizationStream(false), { wrapper: wrapperWith(new QueryClient()) });
    renderHook(() => useOfferNormalizationStream("o1", false), { wrapper: wrapperWith(new QueryClient()) });

    expect(streamMock).not.toHaveBeenCalled();
  });

  it("re-reads the candidate profile on each pushed status and stops on a terminal one", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    streamMock.mockImplementationOnce(async (_target, onStatus) => {
      onStatus({ status: "running" });
      onStatus({ status: "done" });
    });

    renderHook(() => useCandidateNormalizationStream(true), { wrapper: wrapperWith(client) });

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
    expect(streamMock.mock.calls[0][0]).toEqual({ kind: "candidate" });
    expect(invalidatedKeys(invalidate)).toEqual([queryKeys.candidate.profile, queryKeys.candidate.profile]);
    // Terminal reçu : aucune réouverture du flux.
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it("re-reads the offer list and the offer detail on each pushed status, nothing else", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    streamMock.mockImplementationOnce(async (_target, onStatus) => onStatus({ status: "failed" }));

    renderHook(() => useOfferNormalizationStream("o1", true), { wrapper: wrapperWith(client) });

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
    expect(streamMock.mock.calls[0][0]).toEqual({ kind: "offer", offerId: "o1" });
    expect(invalidatedKeys(invalidate)).toEqual([queryKeys.jobOffers.list, queryKeys.jobOffers.detail("o1")]);
  });

  it("treats a never-validated resource (none) as terminal", async () => {
    streamMock.mockImplementationOnce(async (_target, onStatus) => onStatus({ status: "none" }));

    renderHook(() => useCandidateNormalizationStream(true), { wrapper: wrapperWith(new QueryClient()) });

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it("reopens a stream closed by the server (120 s timeout) while the analysis goes on", async () => {
    streamMock
      .mockImplementationOnce(async (_target, onStatus) => onStatus({ status: "running" }))
      .mockImplementationOnce(async (_target, onStatus) => onStatus({ status: "done" }));

    renderHook(() => useCandidateNormalizationStream(true), { wrapper: wrapperWith(new QueryClient()) });

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2), { timeout: 3_000 });
  });

  it("resumes after a network cut, re-reading the resource each time", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    streamMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementationOnce(async (_target, onStatus) => onStatus({ status: "done" }));

    renderHook(() => useCandidateNormalizationStream(true), { wrapper: wrapperWith(client) });

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2), { timeout: 3_000 });
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
  });

  it("reconnects 5 times after the initial attempt on network failures, then gives up", async () => {
    vi.useFakeTimers();
    try {
      streamMock.mockRejectedValue(new TypeError("Failed to fetch"));

      renderHook(() => useCandidateNormalizationStream(true), { wrapper: wrapperWith(new QueryClient()) });
      await vi.advanceTimersByTimeAsync(0);
      expect(streamMock).toHaveBeenCalledTimes(1);

      // Chaque échec réseau rouvre le flux après RECONNECT_DELAY_MS (1 s), cinq fois.
      for (let reconnect = 1; reconnect <= 5; reconnect += 1) {
        await vi.advanceTimersByTimeAsync(1_000);
        expect(streamMock).toHaveBeenCalledTimes(1 + reconnect);
      }

      // Sixième échec consécutif : l'écoute est abandonnée, plus aucune ouverture.
      await vi.advanceTimersByTimeAsync(10_000);
      expect(streamMock).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops listening after a refused stream (404 offer outside the company)", async () => {
    streamMock.mockRejectedValueOnce(new NormalizationStreamError(404));

    renderHook(() => useOfferNormalizationStream("o1", true), { wrapper: wrapperWith(new QueryClient()) });

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it("aborts the stream on unmount and when the analysis is no longer in progress", async () => {
    streamMock.mockImplementation(() => new Promise(() => {}));
    const { rerender, unmount } = renderHook(({ active }) => useOfferNormalizationStream("o1", active), {
      wrapper: wrapperWith(new QueryClient()),
      initialProps: { active: true },
    });
    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    const firstSignal = streamMock.mock.calls[0][2] as AbortSignal;

    rerender({ active: false });
    expect(firstSignal.aborted).toBe(true);

    rerender({ active: true });
    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2));
    const secondSignal = streamMock.mock.calls[1][2] as AbortSignal;
    unmount();
    expect(secondSignal.aborted).toBe(true);
  });

  it("opens one stream per resource: a new offer aborts the previous offer's stream", async () => {
    streamMock.mockImplementation(() => new Promise(() => {}));
    const { rerender } = renderHook(({ offerId }) => useOfferNormalizationStream(offerId, true), {
      wrapper: wrapperWith(new QueryClient()),
      initialProps: { offerId: "o1" },
    });
    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    const firstSignal = streamMock.mock.calls[0][2] as AbortSignal;

    // Même offre re-rendue : aucun second flux.
    rerender({ offerId: "o1" });
    expect(streamMock).toHaveBeenCalledTimes(1);

    rerender({ offerId: "o2" });
    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2));
    expect(firstSignal.aborted).toBe(true);
    expect(streamMock.mock.calls[1][0]).toEqual({ kind: "offer", offerId: "o2" });
  });
});
