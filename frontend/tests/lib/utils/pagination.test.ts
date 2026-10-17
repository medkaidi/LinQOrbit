import { describe, expect, it } from "vitest";

import { nextPageParam } from "@/lib/utils/pagination";

describe("nextPageParam", () => {
  it("asks for the next page while served pages do not cover the total", () => {
    expect(nextPageParam({ page: 0, size: 20, total: 21 })).toBe(1);
    expect(nextPageParam({ page: 1, size: 20, total: 45 })).toBe(2);
  });

  // Régression : page 0-based — une page pleine qui atteint `total` est la dernière,
  // aucune requête de page vide ne doit suivre.
  it("stops on the last page, including an exact fit", () => {
    expect(nextPageParam({ page: 0, size: 20, total: 20 })).toBeUndefined();
    expect(nextPageParam({ page: 1, size: 20, total: 40 })).toBeUndefined();
    expect(nextPageParam({ page: 2, size: 20, total: 45 })).toBeUndefined();
  });

  it("stops at once on a short or empty list", () => {
    expect(nextPageParam({ page: 0, size: 20, total: 5 })).toBeUndefined();
    expect(nextPageParam({ page: 0, size: 20, total: 0 })).toBeUndefined();
  });
});
