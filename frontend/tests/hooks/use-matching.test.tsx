import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/hooks/query-keys";
import { useCurrentMatching, useMatchingStatusStream, useStartMatching } from "@/hooks/use-matching";
import { getCurrentMatching, startMatching, streamMatchingStatus } from "@/lib/api/matching.api";

vi.mock("@/lib/api/matching.api", () => ({
  getCurrentMatching: vi.fn(),
  startMatching: vi.fn(),
  streamMatchingStatus: vi.fn(),
}));

const getMock = vi.mocked(getCurrentMatching);
const startMock = vi.mocked(startMatching);
const streamMock = vi.mocked(streamMatchingStatus);

function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("use-matching", () => {
  beforeEach(() => {
    getMock.mockReset();
    startMock.mockReset();
    streamMock.mockReset();
  });

  it("does not retry a 404 — no match started is a definitive answer", async () => {
    getMock.mockRejectedValue(Object.assign(new Error("404"), { isAxiosError: true, response: { status: 404 } }));

    const { result } = renderHook(() => useCurrentMatching("abcdefghijkl"), {
      wrapper: wrapperWith(new QueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("stays idle while disabled", () => {
    renderHook(() => useCurrentMatching("abcdefghijkl", { enabled: false }), {
      wrapper: wrapperWith(new QueryClient()),
    });

    expect(getMock).not.toHaveBeenCalled();
  });

  it("puts the started match in cache as the current one", async () => {
    const client = new QueryClient();
    const matching = { matchingId: "m-1", status: "pending" as const, sections: [] };
    startMock.mockResolvedValue(matching);

    const { result } = renderHook(() => useStartMatching("abcdefghijkl"), { wrapper: wrapperWith(client) });
    await act(() => result.current.mutateAsync());

    expect(client.getQueryData(queryKeys.matching.current("abcdefghijkl"))).toEqual(matching);
  });

  describe("useMatchingStatusStream", () => {
    it("never opens the stream while inactive", () => {
      renderHook(() => useMatchingStatusStream("abcdefghijkl", false), { wrapper: wrapperWith(new QueryClient()) });

      expect(streamMock).not.toHaveBeenCalled();
    });

    it("invalidates the current match on each pushed status and stops on a terminal one", async () => {
      const client = new QueryClient();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      streamMock.mockImplementationOnce(async (_publicId, onStatus) => {
        onStatus({ matchingId: "m-1", status: "running" });
        onStatus({ matchingId: "m-1", status: "done" });
      });

      renderHook(() => useMatchingStatusStream("abcdefghijkl", true), { wrapper: wrapperWith(client) });

      await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.matching.current("abcdefghijkl") });
      // Terminal reçu : aucune réouverture du flux.
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      expect(streamMock).toHaveBeenCalledTimes(1);
    });

    it("reopens a stream closed by the server while the analysis goes on", async () => {
      streamMock
        .mockImplementationOnce(async (_publicId, onStatus) => onStatus({ matchingId: "m-1", status: "running" }))
        .mockImplementationOnce(async (_publicId, onStatus) => onStatus({ matchingId: "m-1", status: "done" }));

      renderHook(() => useMatchingStatusStream("abcdefghijkl", true), { wrapper: wrapperWith(new QueryClient()) });

      await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2), { timeout: 3_000 });
    });

    it("stops listening after a refused stream and aborts on unmount", async () => {
      streamMock.mockRejectedValueOnce(new Error("409"));
      const { unmount } = renderHook(() => useMatchingStatusStream("abcdefghijkl", true), {
        wrapper: wrapperWith(new QueryClient()),
      });
      await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      expect(streamMock).toHaveBeenCalledTimes(1);

      streamMock.mockImplementationOnce(() => new Promise(() => {}));
      const second = renderHook(() => useMatchingStatusStream("abcdefghijkl", true), {
        wrapper: wrapperWith(new QueryClient()),
      });
      await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2));
      const signal = streamMock.mock.calls[1][2] as AbortSignal;
      second.unmount();
      unmount();
      expect(signal.aborted).toBe(true);
    });
  });
});
