import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentMatching,
  MatchingStreamError,
  parseStatusEvents,
  startMatching,
  streamMatchingStatus,
} from "@/lib/api/matching.api";
import { useAuthStore } from "@/stores/auth-store";
import type { MatchingStatusEvent } from "@/types/matching";

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

describe("matching.api", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    useAuthStore.setState({ token: "jwt-token", user: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.getState().clearAuth();
  });

  it("starts the match of an offer by its public id", async () => {
    const matching = { matchingId: "m-1", status: "pending", sections: [] };
    postMock.mockResolvedValue({ data: matching });

    expect(await startMatching("abcdefghijkl")).toEqual(matching);
    expect(postMock).toHaveBeenCalledWith("/api/v1/matchings", { jobPublicId: "abcdefghijkl" });
  });

  it("reads the current match of an offer", async () => {
    getMock.mockResolvedValue({ data: { matchingId: "m-1", status: "done", sections: [] } });

    await getCurrentMatching("abcdefghijkl");

    expect(getMock).toHaveBeenCalledWith("/api/v1/matchings/offer/abcdefghijkl");
  });

  it("opens the status stream with the bearer token in the header, never in the URL", async () => {
    fetchMock.mockResolvedValue(streamResponse([]));
    const controller = new AbortController();

    await streamMatchingStatus("abcdefghijkl", vi.fn(), controller.signal);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/v1/matchings/offer/abcdefghijkl/events");
    expect(url).not.toContain("jwt-token");
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
    expect(init.headers.Accept).toContain("text/event-stream");
    expect(init.signal).toBe(controller.signal);
  });

  it("delivers each status event, even split across chunks", async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        'event:status\ndata:{"matchingId":"m-1","status":"pen',
        'ding"}\n\nevent:status\ndata:{"matchingId":"m-1","status":"running"}\n\n',
        'event:status\r\ndata:{"matchingId":"m-1","status":"done"}\r\n\r\n',
      ]),
    );
    const events: MatchingStatusEvent[] = [];

    await streamMatchingStatus("abcdefghijkl", (event) => events.push(event), new AbortController().signal);

    expect(events.map((event) => event.status)).toEqual(["pending", "running", "done"]);
  });

  it("clears the session on 401 and reports the failure", async () => {
    fetchMock.mockResolvedValue(streamResponse([], { ok: false, status: 401 }));

    await expect(
      streamMatchingStatus("abcdefghijkl", vi.fn(), new AbortController().signal),
    ).rejects.toEqual(new MatchingStreamError(401));
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("reports a refused stream (404/409) without touching the session", async () => {
    fetchMock.mockResolvedValue(streamResponse([], { ok: false, status: 409 }));

    await expect(
      streamMatchingStatus("abcdefghijkl", vi.fn(), new AbortController().signal),
    ).rejects.toBeInstanceOf(MatchingStreamError);
    expect(useAuthStore.getState().token).toBe("jwt-token");
  });
});

describe("parseStatusEvents", () => {
  it("keeps an unfinished event in the buffer and ignores other event names", () => {
    const seen: string[] = [];

    const rest = parseStatusEvents(
      'event:ping\ndata:{}\n\nevent:status\ndata:{"matchingId":"m","status":"running"}\n\nevent:status\ndata:{"mat',
      (event) => seen.push(event.status),
    );

    expect(seen).toEqual(["running"]);
    expect(rest).toBe('event:status\ndata:{"mat');
  });
});
