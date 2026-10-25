import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/hooks/query-keys";
import {
  useDiscardApplication,
  useSaveApplicationDraft,
  useSubmitApplication,
  useWithdrawApplication,
} from "@/hooks/use-applications";
import {
  discardApplication,
  saveApplicationDraft,
  submitApplication,
  withdrawApplication,
} from "@/lib/api/application.api";
import { buildApplication } from "@/tests/helpers/application-fixtures";

vi.mock("@/lib/api/application.api", () => ({
  getApplicationContext: vi.fn(),
  listMyApplications: vi.fn(),
  saveApplicationDraft: vi.fn(),
  submitApplication: vi.fn(),
  discardApplication: vi.fn(),
  withdrawApplication: vi.fn(),
}));

const saveMock = vi.mocked(saveApplicationDraft);
const submitMock = vi.mocked(submitApplication);
const discardMock = vi.mocked(discardApplication);
const withdrawMock = vi.mocked(withdrawApplication);
const PUBLIC_ID = "abcdefghijkl";

function httpError(status: number) {
  return Object.assign(new Error(String(status)), { isAxiosError: true, response: { status, data: {} } });
}

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, invalidate, wrapper };
}

function invalidatedKeys(invalidate: { mock: { calls: unknown[][] } }) {
  return invalidate.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey);
}

describe("use-applications", () => {
  beforeEach(() => {
    saveMock.mockReset();
    submitMock.mockReset();
    discardMock.mockReset();
    withdrawMock.mockReset();
  });

  it("stays pending until the context is re-read, so the button covers the step change", async () => {
    const { invalidate, wrapper } = setup();
    saveMock.mockResolvedValue(buildApplication({ status: "draft" }));
    const releases: Array<() => void> = [];
    invalidate.mockImplementation(() => new Promise<void>((resolve) => releases.push(resolve)));
    const { result } = renderHook(() => useSaveApplicationDraft(), { wrapper });

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.mutateAsync({ jobPublicId: PUBLIC_ID, answers: [] });
    });

    await vi.waitFor(() => expect(releases).toHaveLength(3));
    expect(result.current.isPending).toBe(true);
    await act(async () => {
      releases.forEach((release) => release());
      await pending;
    });
    await vi.waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it("invalidates the list, the invitations and the context of the offer after a draft save", async () => {
    const { invalidate, wrapper } = setup();
    saveMock.mockResolvedValue(buildApplication({ status: "draft" }));
    const { result } = renderHook(() => useSaveApplicationDraft(), { wrapper });

    await act(() => result.current.mutateAsync({ jobPublicId: PUBLIC_ID, answers: [] }));

    expect(invalidatedKeys(invalidate)).toEqual([
      queryKeys.applications.mine,
      queryKeys.invitations.mine,
      queryKeys.applications.context(PUBLIC_ID),
    ]);
  });

  it("re-reads only the context on a 409, and nothing on another error", async () => {
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSaveApplicationDraft(), { wrapper });

    saveMock.mockRejectedValueOnce(httpError(409));
    await act(() =>
      result.current.mutateAsync({ jobPublicId: PUBLIC_ID, answers: [] }).catch(() => undefined),
    );
    expect(invalidatedKeys(invalidate)).toEqual([queryKeys.applications.context(PUBLIC_ID)]);

    invalidate.mockClear();
    saveMock.mockRejectedValueOnce(httpError(500));
    await act(() =>
      result.current.mutateAsync({ jobPublicId: PUBLIC_ID, answers: [] }).catch(() => undefined),
    );
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("submits the existing draft without creating one, then drops the closed match", async () => {
    const { client, invalidate, wrapper } = setup();
    client.setQueryData(queryKeys.matching.current(PUBLIC_ID), { matchingId: "m-1" });
    submitMock.mockResolvedValue(buildApplication());
    const ensureDraft = vi.fn<() => Promise<string>>();
    const { result } = renderHook(() => useSubmitApplication(PUBLIC_ID), { wrapper });

    await act(() => result.current.mutateAsync({ applicationId: "app-1", ensureDraft, body: {} }));

    expect(ensureDraft).not.toHaveBeenCalled();
    expect(submitMock).toHaveBeenCalledWith("app-1", {});
    expect(client.getQueryData(queryKeys.matching.current(PUBLIC_ID))).toBeUndefined();
    expect(invalidatedKeys(invalidate)).toEqual([
      queryKeys.applications.mine,
      queryKeys.invitations.mine,
      queryKeys.applications.context(PUBLIC_ID),
    ]);
  });

  it("creates the draft first when there is none, within the same mutation", async () => {
    const { wrapper } = setup();
    submitMock.mockResolvedValue(buildApplication());
    const ensureDraft = vi.fn<() => Promise<string>>().mockResolvedValue("app-new");
    const { result } = renderHook(() => useSubmitApplication(PUBLIC_ID), { wrapper });

    await act(() => result.current.mutateAsync({ applicationId: null, ensureDraft }));

    expect(ensureDraft).toHaveBeenCalledTimes(1);
    expect(submitMock).toHaveBeenCalledWith("app-new", undefined);
  });

  it("fails without submitting when the draft cannot be created", async () => {
    const { wrapper } = setup();
    const ensureDraft = vi.fn<() => Promise<string>>().mockRejectedValue(httpError(409));
    const { result } = renderHook(() => useSubmitApplication(PUBLIC_ID), { wrapper });

    await act(() =>
      result.current.mutateAsync({ applicationId: null, ensureDraft }).catch(() => undefined),
    );

    expect(submitMock).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("keeps the match of the couple when a draft is discarded", async () => {
    const { client, invalidate, wrapper } = setup();
    client.setQueryData(queryKeys.matching.current(PUBLIC_ID), { matchingId: "m-1" });
    discardMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDiscardApplication(PUBLIC_ID), { wrapper });

    await act(() => result.current.mutateAsync("app-1"));

    expect(client.getQueryData(queryKeys.matching.current(PUBLIC_ID))).toEqual({ matchingId: "m-1" });
    expect(invalidatedKeys(invalidate)).toEqual([
      queryKeys.applications.mine,
      queryKeys.invitations.mine,
      queryKeys.applications.context(PUBLIC_ID),
    ]);
  });

  it("re-reads only my applications after a withdrawal", async () => {
    const { invalidate, wrapper } = setup();
    withdrawMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useWithdrawApplication(), { wrapper });

    await act(() => result.current.mutateAsync("app-1"));

    expect(invalidatedKeys(invalidate)).toEqual([queryKeys.applications.mine]);
  });
});
