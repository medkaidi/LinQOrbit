import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/hooks/query-keys";
import {
  useInviteCandidate,
  useMyInvitations,
  useRetryScreening,
  useScreeningStream,
  useSuggestedCandidateProfile,
  useSuggestedCandidates,
} from "@/hooks/use-invitations";
import {
  getSuggestedCandidateProfile,
  inviteSuggestedCandidate,
  listMyInvitations,
  listSuggestedCandidates,
  retryScreening,
  ScreeningStreamError,
  streamScreeningStatus,
} from "@/lib/api/invitation.api";

vi.mock("@/lib/api/invitation.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/invitation.api")>();
  return {
    ScreeningStreamError: actual.ScreeningStreamError,
    getSuggestedCandidateProfile: vi.fn(),
    inviteSuggestedCandidate: vi.fn(),
    listMyInvitations: vi.fn(),
    listSuggestedCandidates: vi.fn(),
    retryScreening: vi.fn(),
    streamScreeningStatus: vi.fn(),
  };
});

const inviteMock = vi.mocked(inviteSuggestedCandidate);
const profileMock = vi.mocked(getSuggestedCandidateProfile);
const myInvitationsMock = vi.mocked(listMyInvitations);
const suggestionsMock = vi.mocked(listSuggestedCandidates);
const retryMock = vi.mocked(retryScreening);
const streamMock = vi.mocked(streamScreeningStatus);

function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function invalidatedKeys(invalidate: { mock: { calls: unknown[][] } }) {
  return invalidate.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey);
}

function notFound() {
  return new AxiosError("not found", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 404,
  } as AxiosResponse);
}

function conflict() {
  return new AxiosError("conflict", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 409,
  } as AxiosResponse);
}

beforeEach(() => {
  profileMock.mockReset();
  inviteMock.mockReset();
  myInvitationsMock.mockReset();
  suggestionsMock.mockReset();
  retryMock.mockReset();
  streamMock.mockReset();
});

describe("useSuggestedCandidates", () => {
  it("reads the list of the offer", async () => {
    suggestionsMock.mockResolvedValue({ canInvite: true, items: [] });

    const { result } = renderHook(() => useSuggestedCandidates("o1"), {
      wrapper: wrapperWith(new QueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(suggestionsMock).toHaveBeenCalledWith("o1");
  });

  it("does nothing while disabled or without an offer id", () => {
    renderHook(() => useSuggestedCandidates("o1", false), { wrapper: wrapperWith(new QueryClient()) });
    renderHook(() => useSuggestedCandidates(""), { wrapper: wrapperWith(new QueryClient()) });

    expect(suggestionsMock).not.toHaveBeenCalled();
  });

  it("does not retry a refusal (offer no longer published)", async () => {
    suggestionsMock.mockRejectedValue(conflict());

    const { result } = renderHook(() => useSuggestedCandidates("o1"), {
      wrapper: wrapperWith(new QueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(suggestionsMock).toHaveBeenCalledTimes(1);
  });
});

describe("useInviteCandidate", () => {
  it("re-reads the suggestions of that offer after an invitation", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    inviteMock.mockResolvedValue({
      id: "s1",
      rank: 1,
      firstName: "Ada",
      lastName: "Lovelace",
      title: "Engineer",
      seniority: null,
      yearsOfExperience: null,
      country: null,
      skills: [],
      status: "invited",
    });

    const { result } = renderHook(() => useInviteCandidate("o1"), { wrapper: wrapperWith(client) });
    await act(async () => {
      await result.current.mutateAsync("s1");
    });

    expect(inviteMock).toHaveBeenCalledWith("o1", "s1");
    expect(invalidatedKeys(invalidate)).toEqual([queryKeys.recruiterSuggestions.offer("o1")]);
  });

  it("re-reads the list and the profiles on a 404 too: the consent was withdrawn", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    inviteMock.mockRejectedValue(notFound());

    const { result } = renderHook(() => useInviteCandidate("o1"), { wrapper: wrapperWith(client) });
    await act(async () => {
      await result.current.mutateAsync("s1").catch(() => undefined);
    });

    expect(invalidatedKeys(invalidate)).toEqual([queryKeys.recruiterSuggestions.offer("o1")]);
  });

  it("the offer family covers the list and every profile of that offer only", () => {
    const family = queryKeys.recruiterSuggestions.offer("o1");
    expect(queryKeys.recruiterSuggestions.list("o1").slice(0, family.length)).toEqual(family);
    expect(queryKeys.recruiterSuggestions.profile("o1", "s1").slice(0, family.length)).toEqual(family);
    expect(queryKeys.recruiterSuggestions.list("o2").slice(0, family.length)).not.toEqual(family);
  });

  it("re-reads the list on a 409 too: the real state wins over the error", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    inviteMock.mockRejectedValue(conflict());

    const { result } = renderHook(() => useInviteCandidate("o1"), { wrapper: wrapperWith(client) });
    await act(async () => {
      await result.current.mutateAsync("s1").catch(() => undefined);
    });

    expect(invalidatedKeys(invalidate)).toEqual([queryKeys.recruiterSuggestions.offer("o1")]);
  });

  it("leaves the list alone on any other failure", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    inviteMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useInviteCandidate("o1"), { wrapper: wrapperWith(client) });
    await act(async () => {
      await result.current.mutateAsync("s1").catch(() => undefined);
    });

    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("useSuggestedCandidateProfile", () => {
  it("reads the profile of one suggestion", async () => {
    profileMock.mockResolvedValue({ card: { id: "s1" } } as never);

    const { result } = renderHook(() => useSuggestedCandidateProfile("o1", "s1"), {
      wrapper: wrapperWith(new QueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(profileMock).toHaveBeenCalledWith("o1", "s1");
  });

  it("does not retry a withdrawn consent (404)", async () => {
    profileMock.mockRejectedValue(notFound());

    const { result } = renderHook(() => useSuggestedCandidateProfile("o1", "s1"), {
      wrapper: wrapperWith(new QueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(profileMock).toHaveBeenCalledTimes(1);
  });

  it("stays idle without an offer or a suggestion id", () => {
    renderHook(() => useSuggestedCandidateProfile("", "s1"), { wrapper: wrapperWith(new QueryClient()) });
    renderHook(() => useSuggestedCandidateProfile("o1", ""), { wrapper: wrapperWith(new QueryClient()) });

    expect(profileMock).not.toHaveBeenCalled();
  });
});

describe("useMyInvitations", () => {
  it("reads the invitations of the candidate", async () => {
    myInvitationsMock.mockResolvedValue([]);

    const { result } = renderHook(() => useMyInvitations(), { wrapper: wrapperWith(new QueryClient()) });

    await waitFor(() => expect(result.current.data).toEqual([]));
  });
});

describe("useRetryScreening", () => {
  it("re-reads the offer list and detail after a retry", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    retryMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRetryScreening("o1"), { wrapper: wrapperWith(client) });
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(retryMock).toHaveBeenCalledWith("o1");
    expect(invalidatedKeys(invalidate)).toEqual([queryKeys.jobOffers.list, queryKeys.jobOffers.detail("o1")]);
  });

  it("re-reads the offer on a 409: the status changed meanwhile", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    retryMock.mockRejectedValue(conflict());

    const { result } = renderHook(() => useRetryScreening("o1"), { wrapper: wrapperWith(client) });
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    expect(invalidatedKeys(invalidate)).toEqual([queryKeys.jobOffers.list, queryKeys.jobOffers.detail("o1")]);
  });
});

describe("useScreeningStream", () => {
  it("never opens a stream while no search is in progress", () => {
    renderHook(() => useScreeningStream("o1", false), { wrapper: wrapperWith(new QueryClient()) });

    expect(streamMock).not.toHaveBeenCalled();
  });

  it("re-reads the offer on each pushed signal and stops on a terminal one", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    streamMock.mockImplementationOnce(async (_offerId, onStatus) => {
      onStatus({ status: "running", candidateCount: null });
      onStatus({ status: "done", candidateCount: 10 });
    });

    renderHook(() => useScreeningStream("o1", true), { wrapper: wrapperWith(client) });

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(4));
    expect(streamMock.mock.calls[0][0]).toBe("o1");
    expect(invalidatedKeys(invalidate)).toEqual([
      queryKeys.jobOffers.list,
      queryKeys.jobOffers.detail("o1"),
      queryKeys.jobOffers.list,
      queryKeys.jobOffers.detail("o1"),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it.each(["failed", "none"] as const)("treats %s as terminal", async (status) => {
    streamMock.mockImplementationOnce(async (_offerId, onStatus) =>
      onStatus({ status, candidateCount: null }),
    );

    renderHook(() => useScreeningStream("o1", true), { wrapper: wrapperWith(new QueryClient()) });

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it("reopens a stream closed by the server while the search goes on", async () => {
    streamMock
      .mockImplementationOnce(async (_offerId, onStatus) => onStatus({ status: "running", candidateCount: null }))
      .mockImplementationOnce(async (_offerId, onStatus) => onStatus({ status: "done", candidateCount: 3 }));

    renderHook(() => useScreeningStream("o1", true), { wrapper: wrapperWith(new QueryClient()) });

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2), { timeout: 3_000 });
  });

  it("stops listening after a refused stream (404 offer outside the company)", async () => {
    streamMock.mockRejectedValueOnce(new ScreeningStreamError(404));

    renderHook(() => useScreeningStream("o1", true), { wrapper: wrapperWith(new QueryClient()) });

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(streamMock).toHaveBeenCalledTimes(1);
  });
});
