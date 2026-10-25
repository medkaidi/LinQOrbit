import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    createCriterionReportReview: vi.fn(),
    getAdminDashboard: vi.fn(),
    listAllJobOffers: vi.fn(),
    updateUserStatus: vi.fn(),
    approveSkillSuggestion: vi.fn(),
    linkSkillSuggestion: vi.fn(),
    rejectSkillSuggestion: vi.fn(),
  };
});

import {
  approveSkillSuggestion,
  createCriterionReportReview,
  getAdminDashboard,
  linkSkillSuggestion,
  listAllJobOffers,
  rejectSkillSuggestion,
  updateUserStatus,
} from "@/lib/api/admin.api";
import { queryKeys } from "@/hooks/query-keys";
import {
  useAdminDashboard,
  useApproveSkillSuggestion,
  useCreateCriterionReportReview,
  useInfiniteAdminJobOffers,
  useLinkSkillSuggestion,
  useRejectSkillSuggestion,
  useUpdateUserStatus,
} from "@/hooks/use-admin";
import { useAuthStore } from "@/stores/auth-store";
import type { AdminCriterionReportReview } from "@/types/admin";

const mockedCreateCriterionReportReview = vi.mocked(createCriterionReportReview);
const mockedUpdateUserStatus = vi.mocked(updateUserStatus);
const mockedApproveSkillSuggestion = vi.mocked(approveSkillSuggestion);
const mockedLinkSkillSuggestion = vi.mocked(linkSkillSuggestion);
const mockedRejectSkillSuggestion = vi.mocked(rejectSkillSuggestion);

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

describe("admin dashboard cache", () => {
  function signIn(id: string) {
    useAuthStore.getState().setAuth({
      token: "jwt-token",
      user: {
        id,
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
  }

  function seedDashboards(client: QueryClient) {
    const mine = queryKeys.admin.dashboardFor(adminId);
    client.setQueryData(mine, { liveOffers: 1 });
    return mine;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    signIn(adminId);
  });

  it("keys the figures by the current admin, so 'to review by me' never leaks across sessions", () => {
    expect(queryKeys.admin.dashboardFor("admin-1")).not.toEqual(queryKeys.admin.dashboardFor("admin-2"));
    expect(queryKeys.admin.dashboardFor("admin-1").slice(0, 2)).toEqual(queryKeys.admin.dashboard);
  });

  it("reads the dashboard once under the current admin's key", async () => {
    const client = newQueryClient();
    const dashboard = { liveOffers: 4 };
    vi.mocked(getAdminDashboard).mockResolvedValue(dashboard as never);

    const { result } = renderHook(() => useAdminDashboard(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.data).toBe(dashboard));
    expect(client.getQueryData(queryKeys.admin.dashboardFor(adminId))).toBe(dashboard);
  });

  it("re-reads the figures after an account status change", async () => {
    const client = newQueryClient();
    const mine = seedDashboards(client);
    mockedUpdateUserStatus.mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useUpdateUserStatus(), { wrapper: wrapper(client) });
    await act(async () => {
      await result.current.mutateAsync({ userId: "user-2", status: "INACTIVE" });
    });

    expect(client.getQueryState(mine)?.isInvalidated).toBe(true);
  });

  it.each([
    ["approve", () => useApproveSkillSuggestion(), async (r: ReturnType<typeof useApproveSkillSuggestion>) => {
      mockedApproveSkillSuggestion.mockResolvedValue(undefined as never);
      await r.mutateAsync({ id: "s1", category: "c", skillType: "technical" });
    }],
    ["link", () => useLinkSkillSuggestion(), async (r: ReturnType<typeof useLinkSkillSuggestion>) => {
      mockedLinkSkillSuggestion.mockResolvedValue(undefined as never);
      await r.mutateAsync({ id: "s1", skillId: "k1" });
    }],
    ["reject", () => useRejectSkillSuggestion(), async (r: ReturnType<typeof useRejectSkillSuggestion>) => {
      mockedRejectSkillSuggestion.mockResolvedValue(undefined as never);
      await r.mutateAsync("s1");
    }],
  ] as const)("re-reads the figures after a suggestion is handled (%s)", async (_name, useHook, run) => {
    const client = newQueryClient();
    const mine = seedDashboards(client);

    const { result } = renderHook(() => (useHook as () => never)(), { wrapper: wrapper(client) });
    await act(async () => {
      await (run as (r: never) => Promise<void>)(result.current);
    });

    expect(client.getQueryState(mine)?.isInvalidated).toBe(true);
  });

  it("re-reads the figures after an AI report review", async () => {
    const client = newQueryClient();
    const mine = seedDashboards(client);
    mockedCreateCriterionReportReview.mockResolvedValue(review);

    const { result } = renderHook(() => useCreateCriterionReportReview("report-1"), {
      wrapper: wrapper(client),
    });
    await act(async () => {
      await result.current.mutateAsync({
        verdict: "notUpheld",
        note: null,
        correctedScore: null,
        correctedRationale: null,
      });
    });

    expect(client.getQueryState(mine)?.isInvalidated).toBe(true);
  });
});

describe("useInfiniteAdminJobOffers", () => {
  const page = { items: [], page: 0, size: 20, total: 0 };

  beforeEach(() => {
    vi.mocked(listAllJobOffers).mockReset();
    vi.mocked(listAllJobOffers).mockResolvedValue(page);
  });

  it("reads the first page without any filter by default (absent)", async () => {
    const client = newQueryClient();
    const { result } = renderHook(() => useInfiniteAdminJobOffers(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listAllJobOffers).toHaveBeenCalledWith({ page: 0 }, { signal: expect.any(AbortSignal) });
    expect(client.getQueryData(queryKeys.admin.jobOffersPage({}))).toBeDefined();
  });

  it("passes the filters with the page, and caches each filter set apart", async () => {
    const client = newQueryClient();
    const filters = { q: "acme", status: "draft" as const };
    const { result } = renderHook(() => useInfiniteAdminJobOffers(filters), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listAllJobOffers).toHaveBeenCalledWith(
      { q: "acme", status: "draft", page: 0 },
      { signal: expect.any(AbortSignal) },
    );
    expect(client.getQueryData(queryKeys.admin.jobOffersPage(filters))).toBeDefined();
    expect(client.getQueryData(queryKeys.admin.jobOffersPage({}))).toBeUndefined();
  });

  it("keeps the previous list on screen while a new filter set loads", async () => {
    const client = newQueryClient();
    vi.mocked(listAllJobOffers).mockResolvedValueOnce({ ...page, total: 3 });
    const { result, rerender } = renderHook(
      ({ status }: { status?: "draft" }) => useInfiniteAdminJobOffers(status ? { status } : {}),
      { wrapper: wrapper(client), initialProps: {} as { status?: "draft" } },
    );
    await waitFor(() => expect(result.current.data?.pages[0].total).toBe(3));

    vi.mocked(listAllJobOffers).mockReturnValue(new Promise(() => {}));
    rerender({ status: "draft" });

    expect(result.current.data?.pages[0].total).toBe(3);
    expect(result.current.isPlaceholderData).toBe(true);
  });

  it("keeps the list key under the admin job-offers prefix, apart from an offer's detail key", () => {
    expect(queryKeys.admin.jobOffersPage({ q: "x" })).toEqual(["admin", "job-offers", "list", { q: "x" }]);
    expect(queryKeys.admin.jobOfferDetail("offer-1")).toEqual(["admin", "job-offers", "offer-1"]);
  });
});
