import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicJob, listPublicJobs } from "@/lib/api/public-jobs.api";

vi.mock("@/lib/api/axios", () => ({
  api: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

import { api } from "@/lib/api/axios";

const mockedGet = vi.mocked(api.get);

describe("public-jobs.api", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("reads a published offer through the versioned public endpoint", async () => {
    const job = { publicId: "abcdefghijkl", title: "Backend Engineer" };
    mockedGet.mockResolvedValue({ data: job });

    const result = await getPublicJob("abcdefghijkl");

    // Régression : le chemin omettait le préfixe /api/v1 (route inexistante
    // → 404 Boot → page publique vide après publication).
    expect(mockedGet).toHaveBeenCalledWith("/api/v1/jobs/abcdefghijkl");
    expect(result).toEqual(job);
  });

  it("lists the job board without any page param by default — size never sent", async () => {
    const page = { items: [], page: 0, size: 20, total: 0 };
    mockedGet.mockResolvedValue({ data: page });

    const result = await listPublicJobs();

    const [path, config] = mockedGet.mock.calls[0];
    expect(path).toBe("/api/v1/jobs");
    expect(config?.params).toEqual({});
    expect(config?.params).not.toHaveProperty("size");
    expect(result).toEqual(page);
  });

  it("transmits the requested page (0 included) and forwards the abort signal", async () => {
    mockedGet.mockResolvedValue({ data: { items: [], page: 2, size: 20, total: 0 } });
    const controller = new AbortController();

    await listPublicJobs({ page: 2 }, { signal: controller.signal });

    expect(mockedGet).toHaveBeenCalledWith("/api/v1/jobs", {
      params: { page: 2 },
      signal: controller.signal,
    });
  });
});
