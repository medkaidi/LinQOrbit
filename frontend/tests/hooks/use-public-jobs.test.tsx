import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useInfinitePublicJobs, usePublicJob } from "@/hooks/use-public-jobs";
import { getPublicJob, listPublicJobs } from "@/lib/api/public-jobs.api";
import type { PublicJobPage } from "@/types/public-job";
import { queryKeys } from "@/hooks/query-keys";
import { queryClientWrapper } from "@/tests/helpers/test-utils";

vi.mock("@/lib/api/public-jobs.api", () => ({
  getPublicJob: vi.fn(),
  getRelatedPublicJobs: vi.fn(),
  listPublicJobs: vi.fn(),
}));

const getPublicJobMock = vi.mocked(getPublicJob);
const listPublicJobsMock = vi.mocked(listPublicJobs);

function page(pageIndex: number, total: number): PublicJobPage {
  return { items: [], page: pageIndex, size: 2, total };
}

describe("usePublicJob", () => {
  beforeEach(() => {
    getPublicJobMock.mockReset();
  });

  it("loads the public offer by its publicId", async () => {
    getPublicJobMock.mockResolvedValue({ publicId: "abcdefghijkl" } as never);

    const { result } = renderHook(() => usePublicJob("abcdefghijkl"), {
      wrapper: queryClientWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPublicJobMock).toHaveBeenCalledWith("abcdefghijkl");
  });

  it("does not retry a 404 — the view renders « Job not found » at once", async () => {
    getPublicJobMock.mockRejectedValue(new Error("404"));

    const { result } = renderHook(() => usePublicJob("abcdefghijkl"), {
      wrapper: queryClientWrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getPublicJobMock).toHaveBeenCalledTimes(1);
  });
});

describe("useInfinitePublicJobs — page chaining (D34)", () => {
  beforeEach(() => {
    listPublicJobsMock.mockReset();
  });

  it("requests the next 0-based page while the total is not covered", async () => {
    listPublicJobsMock
      .mockResolvedValueOnce(page(0, 3))
      .mockResolvedValueOnce(page(1, 3));

    const { result } = renderHook(() => useInfinitePublicJobs(), {
      wrapper: queryClientWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(listPublicJobsMock).toHaveBeenLastCalledWith({ page: 1 }, expect.anything());
    expect(result.current.hasNextPage).toBe(false);
  });

  // Régression : l'ancienne condition `page * size < total` réclamait une page vide en trop.
  it("has no next page when the first page covers the total exactly", async () => {
    listPublicJobsMock.mockResolvedValueOnce(page(0, 2));

    const { result } = renderHook(() => useInfinitePublicJobs(), {
      wrapper: queryClientWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
    expect(listPublicJobsMock).toHaveBeenCalledTimes(1);
  });
});

describe("useInfinitePublicJobs — search, filters and sort (T-77)", () => {
  beforeEach(() => {
    listPublicJobsMock.mockReset();
  });

  function stableWrapper() {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
  }

  it("sends the filters with the page, and nothing more without filters", async () => {
    listPublicJobsMock.mockResolvedValue(page(0, 1));
    const { wrapper } = stableWrapper();

    const { result } = renderHook(
      () => useInfinitePublicJobs({ q: "devops", country: "FR", sort: "expiringSoon" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listPublicJobsMock).toHaveBeenCalledWith(
      { q: "devops", country: "FR", sort: "expiringSoon", page: 0 },
      expect.anything(),
    );

    const unfiltered = renderHook(() => useInfinitePublicJobs(), { wrapper });
    await waitFor(() => expect(unfiltered.result.current.isSuccess).toBe(true));
    expect(listPublicJobsMock).toHaveBeenLastCalledWith({ page: 0 }, expect.anything());
  });

  it("keeps the previous list on screen while a new combination loads", async () => {
    const previous: PublicJobPage = { ...page(0, 1), items: [{ publicId: "old" } as never] };
    let release: (value: PublicJobPage) => void = () => {};
    listPublicJobsMock
      .mockResolvedValueOnce(previous)
      .mockReturnValueOnce(new Promise<PublicJobPage>((resolve) => (release = resolve)));
    const { wrapper } = stableWrapper();

    const { result, rerender } = renderHook(
      ({ q }: { q?: string }) => useInfinitePublicJobs(q ? { q } : {}),
      { wrapper, initialProps: {} as { q?: string } },
    );
    await waitFor(() => expect(result.current.data?.pages[0].items).toHaveLength(1));

    rerender({ q: "devops" });

    // Nouvelle clé en vol : l'ancienne page reste affichée, pas d'état « chargement initial ».
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data?.pages[0].items).toHaveLength(1);

    await act(async () => release({ ...page(0, 0), items: [] }));
    await waitFor(() => expect(result.current.data?.pages[0].items).toHaveLength(0));
  });

  it("is refetched by the root list key, so a mutation invalidation reaches filtered pages", async () => {
    listPublicJobsMock.mockResolvedValue(page(0, 1));
    const { client, wrapper } = stableWrapper();
    const { result } = renderHook(() => useInfinitePublicJobs({ q: "devops" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listPublicJobsMock).toHaveBeenCalledTimes(1);

    await act(() => client.invalidateQueries({ queryKey: queryKeys.publicJobs.list }));

    await waitFor(() => expect(listPublicJobsMock).toHaveBeenCalledTimes(2));
  });
});
