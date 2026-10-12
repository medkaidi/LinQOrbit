import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicJob } from "@/lib/api/public-jobs.api";

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
});
