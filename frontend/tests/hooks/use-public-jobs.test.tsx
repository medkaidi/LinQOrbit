import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useInfinitePublicJobs, usePublicJob } from "@/hooks/use-public-jobs";
import { getPublicJob, listPublicJobs } from "@/lib/api/public-jobs.api";
import type { PublicJobPage } from "@/types/public-job";
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
