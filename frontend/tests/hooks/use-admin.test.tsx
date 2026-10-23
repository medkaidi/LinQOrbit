import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    createCriterionReportReview: vi.fn(),
  };
});

import { createCriterionReportReview } from "@/lib/api/admin.api";
import { queryKeys } from "@/hooks/query-keys";
import { useCreateCriterionReportReview } from "@/hooks/use-admin";
import { useAuthStore } from "@/stores/auth-store";
import type { AdminCriterionReportReview } from "@/types/admin";

const mockedCreateCriterionReportReview = vi.mocked(createCriterionReportReview);

const adminId = "admin-1";
const review: AdminCriterionReportReview = {
  id: "review-1",
  verdict: "upheld",
  note: null,
  correctedScore: null,
  correctedRationale: null,
  createdAt: "2026-10-23T10:00:00",
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function newQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function seedCaches(client: QueryClient) {
  const detailKey = queryKeys.admin.criterionReport("report-1", adminId);
  const listKey = queryKeys.admin.criterionReportsPage(adminId);
  const otherListKey = queryKeys.admin.criterionReportsPage("admin-2");
  client.setQueryData(detailKey, { myReview: null, canReview: true });
  client.setQueryData(listKey, { pages: [], pageParams: [] });
  client.setQueryData(otherListKey, { pages: [], pageParams: [] });
  return { detailKey, listKey, otherListKey };
}

describe("useCreateCriterionReportReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setAuth({
      token: "jwt-token",
      user: {
        id: adminId,
        email: "admin@linqorbit.local",
        firstName: "Ada",
        lastName: "Lovelace",
        sex: null,
        phone: null,
        homeCountry: null,
        currentCity: null,
        currentCountry: null,
        roles: [1],
      },
    });
  });

  it("invalidates the report detail and the current admin's list only", async () => {
    const client = newQueryClient();
    const { detailKey, listKey, otherListKey } = seedCaches(client);
    mockedCreateCriterionReportReview.mockResolvedValue(review);

    const { result } = renderHook(
      () => useCreateCriterionReportReview("report-1"),
      { wrapper: wrapper(client) },
    );

    await act(async () => {
      await result.current.mutateAsync({
        verdict: "upheld",
        note: null,
        correctedScore: null,
        correctedRationale: null,
      });
    });

    expect(mockedCreateCriterionReportReview).toHaveBeenCalledWith("report-1", {
      verdict: "upheld",
      note: null,
      correctedScore: null,
      correctedRationale: null,
    });
    expect(client.getQueryData(detailKey)).toEqual({
      myReview: review,
      canReview: false,
    });
    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(otherListKey)?.isInvalidated).toBe(false);
  });

  it("re-reads both caches after a 409 so the stored verdict wins", async () => {
    const client = newQueryClient();
    const { detailKey, listKey, otherListKey } = seedCaches(client);
    const conflict = Object.assign(new Error("Conflict"), {
      isAxiosError: true,
      response: { status: 409 },
    });
    mockedCreateCriterionReportReview.mockRejectedValue(conflict);

    const { result } = renderHook(
      () => useCreateCriterionReportReview("report-1"),
      { wrapper: wrapper(client) },
    );

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          verdict: "upheld",
          note: null,
          correctedScore: null,
          correctedRationale: null,
        }),
      ).rejects.toBe(conflict);
    });

    await waitFor(() => {
      expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    });
    expect(client.getQueryState(otherListKey)?.isInvalidated).toBe(false);
  });
});
