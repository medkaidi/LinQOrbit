import { describe, expect, it } from "vitest";

import { safeReturnTo } from "@/features/auth/return-to";

describe("safeReturnTo", () => {
  it("accepts an internal path", () => {
    expect(safeReturnTo("/applications")).toBe("/applications");
    expect(safeReturnTo("/jobs/abcdefghijkl-backend-engineer/apply")).toBe(
      "/jobs/abcdefghijkl-backend-engineer/apply",
    );
  });

  it("rejects protocol-relative URLs, absolute URLs and backslashes", () => {
    expect(safeReturnTo("//evil.com")).toBeNull();
    expect(safeReturnTo("https://evil.com")).toBeNull();
    expect(safeReturnTo("/\\evil.com")).toBeNull();
  });

  it("rejects missing or repeated parameters", () => {
    expect(safeReturnTo(undefined)).toBeNull();
    expect(safeReturnTo(null)).toBeNull();
    expect(safeReturnTo(["a", "b"])).toBeNull();
  });
});
