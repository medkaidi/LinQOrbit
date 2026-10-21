import { describe, expect, it } from "vitest";

import {
  averageGapValue,
  contestCountLabel,
  contestSummary,
  scoreBand,
} from "@/features/application/recruiter-application-shared";

describe("averageGapValue", () => {
  it("returns null without a gap and formats integers without decimals", () => {
    expect(averageGapValue(null)).toBeNull();
    expect(averageGapValue(20)).toBe("20");
  });

  it("keeps one decimal for a fractional average gap", () => {
    expect(averageGapValue(18.25)).toBe("18.3");
  });
});

describe("contestCountLabel", () => {
  it("uses the singular, the plural and the empty wording", () => {
    expect(contestCountLabel(0)).toBe("No contests");
    expect(contestCountLabel(1)).toBe("1 contested");
    expect(contestCountLabel(3)).toBe("3 contested");
  });
});

describe("scoreBand", () => {
  it("uses the fixed green/orange/gray thresholds and clamps out-of-range values", () => {
    expect(scoreBand(null)).toBe("none");
    expect(scoreBand(0)).toBe("weak");
    expect(scoreBand(39)).toBe("weak");
    expect(scoreBand(40)).toBe("partial");
    expect(scoreBand(69)).toBe("partial");
    expect(scoreBand(70)).toBe("strong");
    expect(scoreBand(100)).toBe("strong");
    expect(scoreBand(-5)).toBe("weak");
    expect(scoreBand(120)).toBe("strong");
  });
});

describe("contestSummary", () => {
  it("combines the count and the average gap when both exist", () => {
    expect(contestSummary(3, 18.25)).toBe("3 contested · avg gap 18.3 pts");
    expect(contestSummary(2, 20)).toBe("2 contested · avg gap 20 pts");
  });

  it("falls back to the count alone without a gap", () => {
    expect(contestSummary(1, null)).toBe("1 contested");
    expect(contestSummary(0, null)).toBe("No contests");
  });
});
