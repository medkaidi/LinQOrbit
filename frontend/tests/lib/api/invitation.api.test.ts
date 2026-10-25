import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSuggestedCandidateProfile,
  inviteSuggestedCandidate,
  listMyInvitations,
  listSuggestedCandidates,
  retryScreening,
  ScreeningStreamError,
  screeningEventsPath,
  streamScreeningStatus,
} from "@/lib/api/invitation.api";
import { useAuthStore } from "@/stores/auth-store";
import type { ScreeningStatusEvent } from "@/types/invitation";

vi.mock("@/lib/api/axios", () => ({
  api: { get: vi.fn(), post: vi.fn(), defaults: { baseURL: "http://api.test" } },
}));

import { api } from "@/lib/api/axios";

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);

/** Réponse fetch dont le corps livre les morceaux donnés, dans l'ordre. */
function streamResponse(chunks: string[], init: { ok?: boolean; status?: number } = {}) {
  const encoder = new TextEncoder();
  const queue = [...chunks];
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    body: {
      getReader: () => ({
        read: async () =>
          queue.length > 0
            ? { value: encoder.encode(queue.shift() as string), done: false }
            : { value: undefined, done: true },
      }),
    },
  } as unknown as Response;
}

describe("invitation.api requests", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("reads the suggested candidates of one offer without any query parameter", async () => {
    getMock.mockResolvedValue({ data: { canInvite: true, items: [] } });

    const result = await listSuggestedCandidates("o1");

    expect(getMock).toHaveBeenCalledWith("/api/v1/job-offers/o1/suggested-candidates");
    expect(result).toEqual({ canInvite: true, items: [] });
  });

  it("reads the full profile of one suggestion by its row id, without any query parameter", async () => {
    getMock.mockResolvedValue({ data: { card: { id: "s1" }, canInvite: true } });

    const result = await getSuggestedCandidateProfile("o1", "s1");

    expect(getMock).toHaveBeenCalledWith("/api/v1/job-offers/o1/suggested-candidates/s1/profile");
    expect(result).toEqual({ card: { id: "s1" }, canInvite: true });
  });

  it("invites by the suggestion (row) id carried by the card, never a candidate id", async () => {
    postMock.mockResolvedValue({ data: { id: "s1", status: "invited" } });

    const card = await inviteSuggestedCandidate("o1", "s1");

    expect(postMock).toHaveBeenCalledWith("/api/v1/job-offers/o1/suggested-candidates/s1/invitations");
    expect(card).toEqual({ id: "s1", status: "invited" });
  });

  it("reads the invitations of the signed-in candidate", async () => {
    getMock.mockResolvedValue({ data: [] });

    await expect(listMyInvitations()).resolves.toEqual([]);
    expect(getMock).toHaveBeenCalledWith("/api/v1/candidates/me/invitations");
  });

  it("retries the search of one offer with a bodyless POST", async () => {
    postMock.mockResolvedValue({ data: { status: "pending", candidateCount: null } });

    await retryScreening("o1");

    expect(postMock).toHaveBeenCalledWith("/api/v1/job-offers/o1/screening/retry");
  });
});

describe("screeningEventsPath", () => {
  it("targets one offer's stream, never an id in a query string", () => {
    expect(screeningEventsPath("o1")).toBe("/api/v1/job-offers/o1/screening/events");
  });
});

describe("streamScreeningStatus", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    useAuthStore.setState({ token: "jwt-token", user: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.getState().clearAuth();
  });

  it("opens the stream with the bearer token in the header, never in the URL", async () => {
    fetchMock.mockResolvedValue(streamResponse([]));
    const controller = new AbortController();

    await streamScreeningStatus("o1", vi.fn(), controller.signal);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/v1/job-offers/o1/screening/events");
    expect(url).not.toContain("jwt-token");
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
    expect(init.headers.Accept).toContain("text/event-stream");
    expect(init.signal).toBe(controller.signal);
  });

  it("delivers each signal with its candidate count, even split across chunks", async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        'event:status\ndata:{"status":"run',
        'ning","candidateCount":null}\n\nevent:status\ndata:{"status":"done","candidateCount":10}\n\n',
      ]),
    );
    const events: ScreeningStatusEvent[] = [];

    await streamScreeningStatus("o1", (event) => events.push(event), new AbortController().signal);

    expect(events).toEqual([
      { status: "running", candidateCount: null },
      { status: "done", candidateCount: 10 },
    ]);
  });

  it("clears the session on 401 and reports the typed failure", async () => {
    fetchMock.mockResolvedValue(streamResponse([], { ok: false, status: 401 }));

    await expect(streamScreeningStatus("o1", vi.fn(), new AbortController().signal)).rejects.toEqual(
      new ScreeningStreamError(401),
    );
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("reports a refused stream (404) without touching the session", async () => {
    fetchMock.mockResolvedValue(streamResponse([], { ok: false, status: 404 }));

    await expect(streamScreeningStatus("o1", vi.fn(), new AbortController().signal)).rejects.toBeInstanceOf(
      ScreeningStreamError,
    );
    expect(useAuthStore.getState().token).toBe("jwt-token");
  });
});
