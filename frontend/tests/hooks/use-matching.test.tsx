import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/hooks/query-keys";
import {
  useAnswerClarification,
  useAssessmentStepSync,
  useCurrentMatching,
  useFinishAssessment,
  useMatchingStatusStream,
  useSaveMatchingFeedback,
  useSkipClarification,
  useStartMatching,
} from "@/hooks/use-matching";
import {
  answerClarification,
  finishAssessment,
  getCurrentMatching,
  MatchingStreamError,
  saveMatchingFeedback,
  skipClarification,
  startMatching,
  streamMatchingStatus,
} from "@/lib/api/matching.api";
import type { Matching } from "@/types/matching";
import { buildMatching } from "@/tests/helpers/matching-fixtures";

vi.mock("@/lib/api/matching.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/matching.api")>();
  return {
    MatchingStreamError: actual.MatchingStreamError,
    getCurrentMatching: vi.fn(),
    startMatching: vi.fn(),
    streamMatchingStatus: vi.fn(),
    answerClarification: vi.fn(),
    skipClarification: vi.fn(),
    finishAssessment: vi.fn(),
    saveMatchingFeedback: vi.fn(),
  };
});

const getMock = vi.mocked(getCurrentMatching);
const startMock = vi.mocked(startMatching);
const streamMock = vi.mocked(streamMatchingStatus);
const answerMock = vi.mocked(answerClarification);
const skipMock = vi.mocked(skipClarification);
const finishMock = vi.mocked(finishAssessment);
const feedbackMock = vi.mocked(saveMatchingFeedback);
const PUBLIC_ID = "abcdefghijkl";
const CURRENT_KEY = queryKeys.matching.current(PUBLIC_ID);
const CONTEXT_KEY = queryKeys.applications.context(PUBLIC_ID);

function conflict() {
  return Object.assign(new Error("409"), { isAxiosError: true, response: { status: 409, data: {} } });
}

function quietClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
}

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
    answerMock.mockReset();
    skipMock.mockReset();
    finishMock.mockReset();
    feedbackMock.mockReset();
  });

  describe("clarifications", () => {
    it("puts the match returned by an answer in cache as the current one", async () => {
      const client = quietClient();
      const updated = buildMatching({ status: "pending", sections: [{ section: "languages", criteria: [] }] });
      answerMock.mockResolvedValue(updated);

      const { result } = renderHook(() => useAnswerClarification(PUBLIC_ID), { wrapper: wrapperWith(client) });
      await act(() => result.current.mutateAsync({ clarificationId: "c-1", answer: "Yes" }));

      expect(answerMock).toHaveBeenCalledWith(PUBLIC_ID, "c-1", "Yes");
      expect(client.getQueryData(CURRENT_KEY)).toEqual(updated);
    });

    it("puts the match returned by a skip in cache as the current one", async () => {
      const client = quietClient();
      const updated = buildMatching({ status: "pending" });
      skipMock.mockResolvedValue(updated);

      const { result } = renderHook(() => useSkipClarification(PUBLIC_ID), { wrapper: wrapperWith(client) });
      await act(() => result.current.mutateAsync("c-1"));

      expect(skipMock).toHaveBeenCalledWith(PUBLIC_ID, "c-1");
      expect(client.getQueryData(CURRENT_KEY)).toEqual(updated);
    });

    it("re-reads the match on a 409 (question closed elsewhere), keeps it otherwise", async () => {
      const client = quietClient();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      answerMock.mockRejectedValueOnce(conflict()).mockRejectedValueOnce(new Error("network"));

      const { result } = renderHook(() => useAnswerClarification(PUBLIC_ID), { wrapper: wrapperWith(client) });
      await act(() => result.current.mutateAsync({ clarificationId: "c-1", answer: "Yes" }).catch(() => undefined));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: CURRENT_KEY });

      invalidate.mockClear();
      await act(() => result.current.mutateAsync({ clarificationId: "c-1", answer: "Yes" }).catch(() => undefined));
      expect(invalidate).not.toHaveBeenCalled();
    });

    it("re-reads the match and the journey context after finishing, pending until both are re-read", async () => {
      const client = quietClient();
      let releaseContext: () => void = () => {};
      client.setQueryData(CONTEXT_KEY, { step: "matching" });
      // Observateurs actifs : l'invalidation relance réellement les deux lectures.
      getMock.mockResolvedValue(buildMatching({ status: "done", assessmentFinished: true }));
      const contextRead = vi.fn(() => new Promise((resolve) => (releaseContext = () => resolve({ step: "matching" }))));
      finishMock.mockResolvedValue(undefined);

      const { result } = renderHook(
        () => {
          useCurrentMatching(PUBLIC_ID);
          useQuery({ queryKey: CONTEXT_KEY, queryFn: contextRead });
          return useFinishAssessment(PUBLIC_ID);
        },
        { wrapper: wrapperWith(client) },
      );
      await waitFor(() => expect(contextRead).toHaveBeenCalledTimes(1));
      releaseContext();

      act(() => result.current.mutate());
      await waitFor(() => expect(contextRead).toHaveBeenCalledTimes(2));
      expect(finishMock).toHaveBeenCalledWith(PUBLIC_ID);
      expect(result.current.isPending).toBe(true);
      releaseContext();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("candidate review", () => {
    it("replaces the feedback of the cached match, scores untouched, and re-reads the context", async () => {
      const client = quietClient();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const before = buildMatching({
        status: "done",
        assessmentFinished: true,
        sections: [{ section: "required_skills", criteria: [{ key: "skill:java", label: "Java", score: 80 }] }],
        feedback: [{ criterionKey: "skill:java", selfValue: 50, comment: "old" }],
      });
      client.setQueryData(CURRENT_KEY, before);
      const items = [{ criterionKey: "skill:java", selfValue: 90, comment: null }];
      feedbackMock.mockResolvedValue({ items });
      const values = { items: [{ criterionKey: "skill:java", selfValue: "90", comment: "" }] };

      const { result } = renderHook(() => useSaveMatchingFeedback(PUBLIC_ID), { wrapper: wrapperWith(client) });
      await act(() => result.current.mutateAsync(values));

      expect(feedbackMock).toHaveBeenCalledWith(PUBLIC_ID, values);
      expect(client.getQueryData<Matching>(CURRENT_KEY)).toEqual({ ...before, feedback: items });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: CONTEXT_KEY });
    });

    it("re-reads the match when the review is refused with a 409", async () => {
      const client = quietClient();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      feedbackMock.mockRejectedValue(conflict());

      const { result } = renderHook(() => useSaveMatchingFeedback(PUBLIC_ID), { wrapper: wrapperWith(client) });
      await act(() => result.current.mutateAsync({ items: [] }).catch(() => undefined));

      expect(invalidate).toHaveBeenCalledWith({ queryKey: CURRENT_KEY });
      expect(invalidate).not.toHaveBeenCalledWith({ queryKey: CONTEXT_KEY });
    });
  });

  describe("useAssessmentStepSync", () => {
    function syncWith(matching: Matching | undefined, contextFinished: boolean | undefined) {
      const client = new QueryClient();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      const view = renderHook(
        ({ value, finished }) => useAssessmentStepSync(PUBLIC_ID, value, finished),
        { wrapper: wrapperWith(client), initialProps: { value: matching, finished: contextFinished } },
      );
      return { invalidate, ...view };
    }

    it("re-reads the context once when a finished match contradicts it", () => {
      const finished = buildMatching({ status: "done", assessmentFinished: true });
      const { invalidate, rerender } = syncWith(finished, false);

      expect(invalidate).toHaveBeenCalledTimes(1);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: CONTEXT_KEY });
      // Même désaccord, nouveau rendu : pas de boucle.
      rerender({ value: { ...finished }, finished: false });
      expect(invalidate).toHaveBeenCalledTimes(1);
      // Contexte relu et d'accord : rien de plus.
      rerender({ value: finished, finished: true });
      expect(invalidate).toHaveBeenCalledTimes(1);
    });

    it("leaves the context alone when both agree, during an analysis, or without data", () => {
      expect(syncWith(buildMatching({ status: "done", assessmentFinished: true }), true).invalidate).not.toHaveBeenCalled();
      expect(syncWith(buildMatching({ status: "done" }), false).invalidate).not.toHaveBeenCalled();
      expect(syncWith(buildMatching({ status: "running", assessmentFinished: true }), false).invalidate).not.toHaveBeenCalled();
      expect(syncWith(undefined, false).invalidate).not.toHaveBeenCalled();
      expect(syncWith(buildMatching({ status: "done", assessmentFinished: true }), undefined).invalidate).not.toHaveBeenCalled();
    });
  });

  it("does not retry a 404 — no match started is a definitive answer", async () => {
    getMock.mockRejectedValue(Object.assign(new Error("404"), { isAxiosError: true, response: { status: 404 } }));

    const { result } = renderHook(() => useCurrentMatching("abcdefghijkl"), {
      wrapper: wrapperWith(new QueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("puts the started match in cache as the current one", async () => {
    const client = new QueryClient();
    const matching = buildMatching();
    startMock.mockResolvedValue(matching);

    const { result } = renderHook(() => useStartMatching("abcdefghijkl"), { wrapper: wrapperWith(client) });
    await act(() => result.current.mutateAsync());

    expect(client.getQueryData(queryKeys.matching.current("abcdefghijkl"))).toEqual(matching);
  });

  it("runs the preparation before starting, within the same mutation", async () => {
    const order: string[] = [];
    const prepare = vi.fn(async () => {
      order.push("prepare");
    });
    startMock.mockImplementation(async () => {
      order.push("start");
      return buildMatching();
    });

    const { result } = renderHook(() => useStartMatching("abcdefghijkl"), { wrapper: wrapperWith(new QueryClient()) });
    await act(() => result.current.mutateAsync(prepare));

    expect(order).toEqual(["prepare", "start"]);
  });

  it("leaves the cached match untouched when the start fails", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const previous = buildMatching({ matchingId: "m-0", status: "failed" });
    client.setQueryData(queryKeys.matching.current("abcdefghijkl"), previous);
    startMock.mockRejectedValue(new Error("409"));

    const { result } = renderHook(() => useStartMatching("abcdefghijkl"), { wrapper: wrapperWith(client) });
    await act(() => result.current.mutateAsync(undefined).catch(() => undefined));

    expect(client.getQueryData(queryKeys.matching.current("abcdefghijkl"))).toEqual(previous);
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

    it("resumes after a network cut, re-reading the match each time", async () => {
      const client = new QueryClient();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      streamMock
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockImplementationOnce(async (_publicId, onStatus) => onStatus({ matchingId: "m-1", status: "done" }));

      renderHook(() => useMatchingStatusStream("abcdefghijkl", true), { wrapper: wrapperWith(client) });

      await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2), { timeout: 3_000 });
      // Une relecture après la coupure, une après l'événement terminal.
      await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
    });

    it("gives up after repeated network cuts instead of retrying forever", async () => {
      streamMock.mockRejectedValue(new TypeError("Failed to fetch"));

      renderHook(() => useMatchingStatusStream("abcdefghijkl", true), { wrapper: wrapperWith(new QueryClient()) });

      // 1 ouverture + 5 reprises, puis plus rien.
      await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(6), { timeout: 8_000 });
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      expect(streamMock).toHaveBeenCalledTimes(6);
    }, 15_000);

    it("aborts the stream of the previous offer when the offer changes", async () => {
      streamMock.mockImplementation(() => new Promise(() => {}));
      const { rerender } = renderHook(({ publicId }) => useMatchingStatusStream(publicId, true), {
        wrapper: wrapperWith(new QueryClient()),
        initialProps: { publicId: "abcdefghijkl" },
      });
      await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
      const firstSignal = streamMock.mock.calls[0][2] as AbortSignal;

      rerender({ publicId: "mnopqrstuvwx" });

      await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2));
      expect(firstSignal.aborted).toBe(true);
      expect(streamMock.mock.calls[1][0]).toBe("mnopqrstuvwx");
    });

    it("stops listening after a refused stream and aborts on unmount", async () => {
      streamMock.mockRejectedValueOnce(new MatchingStreamError(409));
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
