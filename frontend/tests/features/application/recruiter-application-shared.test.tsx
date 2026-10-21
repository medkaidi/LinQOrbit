import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  averageGapValue,
  candidateInitials,
  contestCountLabel,
  contestSummary,
  displayScore,
  scoreBand,
  ScorePercentChip,
  ScorePercentValue,
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

describe("displayScore", () => {
  it("rounds the displayed value and clamps it to the 0-100 scale", () => {
    expect(displayScore(null)).toBeNull();
    expect(displayScore(69.5)).toBe(70);
    expect(displayScore(69.4)).toBe(69);
    expect(displayScore(-5)).toBe(0);
    expect(displayScore(120)).toBe(100);
  });
});

describe("ScorePercentValue", () => {
  it("colors the rounded value with its band and keeps the unit neutral", () => {
    render(<ScorePercentValue score={70} />);
    const value = screen.getByText("70");
    expect(value.parentElement).toHaveClass("text-success-text");
    expect(value.parentElement).toHaveTextContent("70%");
    expect(screen.getByText("%")).toHaveClass("text-text-tertiary");
  });

  it("renders nothing without a score — an absent section is never a zero", () => {
    const { container } = render(<ScorePercentValue score={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ScorePercentChip", () => {
  it("tints the chip with the band surface and colors the value", () => {
    render(<ScorePercentChip score={55} />);
    const chip = screen.getByText("55").parentElement;
    expect(chip).toHaveClass("bg-orange-subtle");
    expect(chip).toHaveClass("text-orange-deep");
    expect(chip).toHaveTextContent("55%");
  });
});

describe("candidateInitials", () => {
  it("keeps the two first letters of the name, uppercased", () => {
    expect(candidateInitials("Grace Hopper")).toBe("GH");
    expect(candidateInitials("Ada")).toBe("A");
    expect(candidateInitials("Alan Mathison Turing")).toBe("AM");
  });
});
