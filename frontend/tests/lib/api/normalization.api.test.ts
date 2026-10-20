import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NormalizationStreamError,
  normalizationEventsPath,
  parseNormalizationEvents,
  streamNormalizationStatus,
} from "@/lib/api/normalization.api";
import { useAuthStore } from "@/stores/auth-store";
import type { NormalizationStatusEvent } from "@/types/normalization";

vi.mock("@/lib/api/axios", () => ({
  api: { defaults: { baseURL: "http://api.test" } },
}));

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

describe("normalizationEventsPath", () => {
  it("targets the signed-in candidate's profile or one offer, never an id in a query string", () => {
    expect(normalizationEventsPath({ kind: "candidate" })).toBe(
      "/api/v1/candidates/me/profile/normalization/events",
    );
    expect(normalizationEventsPath({ kind: "offer", offerId: "o1" })).toBe(
      "/api/v1/job-offers/o1/normalization/events",
    );
  });
});

describe("parseNormalizationEvents", () => {
  it("delivers complete status events and keeps an unfinished one in the buffer", () => {
    const seen: string[] = [];

    const rest = parseNormalizationEvents(
      'event:status\ndata:{"status":"pending"}\n\nevent:status\ndata:{"status":"running"}\n\nevent:status\ndata:{"sta',
      (event) => seen.push(event.status),
    );

    expect(seen).toEqual(["pending", "running"]);
    expect(rest).toBe('event:status\ndata:{"sta');
  });

  it("ignores other event names and comments, and accepts CRLF line endings", () => {
    const seen: string[] = [];

    const rest = parseNormalizationEvents(
      ':keep-alive\n\nevent:ping\ndata:{}\n\nevent:status\r\ndata:{"status":"done"}\r\n\r\n',
      (event) => seen.push(event.status),
    );

    expect(seen).toEqual(["done"]);
    expect(rest).toBe("");
  });
});

describe("streamNormalizationStatus", () => {
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

  it("opens the stream on the axios base URL with the bearer token in the header, never in the URL", async () => {
    fetchMock.mockResolvedValue(streamResponse([]));
    const controller = new AbortController();

    await streamNormalizationStatus({ kind: "offer", offerId: "o1" }, vi.fn(), controller.signal);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/v1/job-offers/o1/normalization/events");
    expect(url).not.toContain("jwt-token");
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
    expect(init.headers.Accept).toContain("text/event-stream");
    expect(init.signal).toBe(controller.signal);
  });

  it("delivers each status event, even split across chunks, then resolves when the server closes", async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        'event:status\ndata:{"status":"pen',
        'ding"}\n\nevent:status\ndata:{"status":"running"}\n\n',
        'event:status\ndata:{"status":"done"}\n\n',
      ]),
    );
    const events: NormalizationStatusEvent[] = [];

    await streamNormalizationStatus({ kind: "candidate" }, (event) => events.push(event), new AbortController().signal);

    expect(events.map((event) => event.status)).toEqual(["pending", "running", "done"]);
  });

  it("clears the session on 401 and reports the failure", async () => {
    fetchMock.mockResolvedValue(streamResponse([], { ok: false, status: 401 }));

    await expect(
      streamNormalizationStatus({ kind: "candidate" }, vi.fn(), new AbortController().signal),
    ).rejects.toEqual(new NormalizationStreamError(401));
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("reports a refused offer stream (404) without touching the session", async () => {
    fetchMock.mockResolvedValue(streamResponse([], { ok: false, status: 404 }));

    await expect(
      streamNormalizationStatus({ kind: "offer", offerId: "o1" }, vi.fn(), new AbortController().signal),
    ).rejects.toBeInstanceOf(NormalizationStreamError);
    expect(useAuthStore.getState().token).toBe("jwt-token");
  });
});
