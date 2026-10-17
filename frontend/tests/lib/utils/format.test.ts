import { describe, expect, it } from "vitest";

import { formatFileSize, formatShortDate, plural } from "@/lib/utils/format";

describe("formatFileSize", () => {
  it("renders bytes, kilobytes and megabytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1023)).toBe("1023 B");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(240_000)).toBe("234 KB");
    expect(formatFileSize(1_572_864)).toBe("1.5 MB");
  });
});

describe("formatShortDate", () => {
  it("renders a short english date", () => {
    expect(formatShortDate("2026-10-16T09:00:00")).toBe("Oct 16, 2026");
  });

  it("returns an unreadable input as-is", () => {
    expect(formatShortDate("not-a-date")).toBe("not-a-date");
  });
});

describe("plural", () => {
  it("keeps the singular for one", () => {
    expect(plural(1, "file")).toBe("1 file");
    expect(plural(1, "entry")).toBe("1 entry");
  });

  it("regular plural and y → ies", () => {
    expect(plural(2, "file")).toBe("2 files");
    expect(plural(3, "entry")).toBe("3 entries");
  });
});
