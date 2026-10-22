import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCriterionReport, listAllJobOffers, listCriterionReports, listUsers } from "@/lib/api/admin.api";

vi.mock("@/lib/api/axios", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/lib/api/axios";

const mockedGet = vi.mocked(api.get);

const emptyPage = { items: [], page: 0, size: 20, total: 0 };

describe("admin.api", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({ data: emptyPage });
  });

  it("sends only the page when no user filter is set", async () => {
    await listUsers({ page: 0 });

    expect(mockedGet).toHaveBeenCalledWith("/api/v1/admin/users", {
      params: { page: 0 },
      signal: undefined,
    });
  });

  it("omits empty or undefined user filters instead of sending empty keys", async () => {
    await listUsers({ page: 0, q: "", status: undefined, capability: undefined });

    expect(mockedGet).toHaveBeenCalledWith("/api/v1/admin/users", {
      params: { page: 0 },
      signal: undefined,
    });
  });

  it("sends set user filters, and never a size (the backend decides)", async () => {
    await listUsers({ page: 2, q: "ada", status: "inactive", capability: "candidate" });

    expect(mockedGet).toHaveBeenCalledWith("/api/v1/admin/users", {
      params: { page: 2, q: "ada", status: "inactive", capability: "candidate" },
      signal: undefined,
    });
  });

  it("sends only the page when no offer filter is set", async () => {
    await listAllJobOffers({ page: 0 });

    expect(mockedGet).toHaveBeenCalledWith("/api/v1/admin/job-offers", {
      params: { page: 0 },
      signal: undefined,
    });
  });

  it("sends the offer status filter when set, and never a size", async () => {
    await listAllJobOffers({ status: "draft", page: 1 });

    expect(mockedGet).toHaveBeenCalledWith("/api/v1/admin/job-offers", {
      params: { status: "draft", page: 1 },
      signal: undefined,
    });
  });

  it("lists the AI reports with the page only, never a size", async () => {
    await listCriterionReports({ page: 2 });

    expect(mockedGet).toHaveBeenCalledWith("/api/v1/admin/criterion-reports", {
      params: { page: 2 },
      signal: undefined,
    });
  });

  it("reads a single AI report by id, with the abort signal", async () => {
    const signal = new AbortController().signal;

    await getCriterionReport("report-1", { signal });

    expect(mockedGet).toHaveBeenCalledWith("/api/v1/admin/criterion-reports/report-1", {
      signal,
    });
  });
});
