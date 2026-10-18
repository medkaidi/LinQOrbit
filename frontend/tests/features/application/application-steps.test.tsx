import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ApplicationSteps } from "@/features/application/application-steps";
import type { ApplicationStep } from "@/types/application";

function itemsFor(step: ApplicationStep) {
  render(<ApplicationSteps step={step} />);
  return within(screen.getByRole("navigation", { name: "Application progress" })).getAllByRole("listitem");
}

describe("ApplicationSteps", () => {
  it("lists the three MVP steps in order", () => {
    const items = itemsFor("recruiter_questions");

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Recruiter questions"),
      expect.stringContaining("Match"),
      expect.stringContaining("Submit"),
    ]);
  });

  it("marks the recruiter questions as current before they are answered", () => {
    const items = itemsFor("recruiter_questions");

    expect(items[0]).toHaveAttribute("aria-current", "step");
    expect(items[1]).not.toHaveAttribute("aria-current");
    expect(items[1]).toHaveTextContent("Optional");
  });

  it("marks the questions done and the optional match current once the draft is complete", () => {
    const items = itemsFor("matching");

    expect(items[0]).toHaveTextContent("Done");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[1]).toHaveAttribute("aria-current", "step");
  });

  it("marks every step done once the application is submitted", () => {
    const items = itemsFor("submitted");

    expect(items.every((item) => item.textContent?.includes("Done"))).toBe(true);
    expect(items.some((item) => item.hasAttribute("aria-current"))).toBe(false);
  });
});
