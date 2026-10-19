import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ApplicationSteps } from "@/features/application/application-steps";
import type { ApplicationAssessment, ApplicationStep } from "@/types/application";

const NOT_ASSESSED: ApplicationAssessment = { matched: false, assessmentFinished: false, contested: false };

function itemsFor(
  step: ApplicationStep,
  hasRecruiterQuestions = true,
  assessment: ApplicationAssessment = NOT_ASSESSED,
) {
  render(<ApplicationSteps step={step} assessment={assessment} hasRecruiterQuestions={hasRecruiterQuestions} />);
  return within(screen.getByRole("region", { name: "Application progress" })).getAllByRole("listitem");
}

describe("ApplicationSteps", () => {
  it("lists the four steps in order when the recruiter asks questions", () => {
    const items = itemsFor("recruiter_questions");

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Step 1Recruiter questions"),
      expect.stringContaining("Step 2AI clarifications"),
      expect.stringContaining("Step 3Candidate review"),
      expect.stringContaining("Step 4Summary & apply"),
    ]);
  });

  it("drops the recruiter questions step and renumbers when the offer has none", () => {
    const items = itemsFor("matching", false);

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Step 1AI clarifications"),
      expect.stringContaining("Step 2Candidate review"),
      expect.stringContaining("Step 3Summary & apply"),
    ]);
    expect(items[0]).toHaveAttribute("aria-current", "step");
    expect(items[0]).toHaveTextContent("In progress");
  });

  it("marks the recruiter questions as current before they are answered", () => {
    const items = itemsFor("recruiter_questions");

    expect(items[0]).toHaveAttribute("aria-current", "step");
    expect(items[0]).toHaveTextContent("In progress");
    expect(items[1]).toHaveTextContent("Upcoming");
    expect(items[3]).toHaveTextContent("Final step");
  });

  it("keeps the recruiter questions rule whatever the assessment says", () => {
    const items = itemsFor("recruiter_questions", true, { matched: true, assessmentFinished: true, contested: true });

    expect(items[0]).toHaveAttribute("aria-current", "step");
    expect(items[1]).toHaveTextContent("Upcoming");
    expect(items[2]).toHaveTextContent("Upcoming");
  });

  it("opens the AI clarifications once the required questions are answered", () => {
    const items = itemsFor("matching");

    expect(items[0]).toHaveTextContent("Done");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[2]).toHaveTextContent("Upcoming");
  });

  it("keeps the AI clarifications current while the assessment is open, even once matched", () => {
    const items = itemsFor("matching", true, { matched: true, assessmentFinished: false, contested: false });

    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[2]).toHaveTextContent("Upcoming");
    expect(items[3]).toHaveTextContent("Final step");
  });

  it("moves to the candidate review once the assessment is finished", () => {
    const items = itemsFor("matching", true, { matched: true, assessmentFinished: true, contested: false });

    expect(items[1]).toHaveTextContent("Done");
    expect(items[1]).not.toHaveAttribute("aria-current");
    expect(items[2]).toHaveAttribute("aria-current", "step");
    expect(items[2]).toHaveTextContent("In progress");
    expect(items[3]).toHaveTextContent("Final step");
  });

  it("marks clarifications and review as skipped after a direct submission, never as done", () => {
    const items = itemsFor("submitted");

    expect(items[0]).toHaveTextContent("Done");
    expect(items[1]).toHaveTextContent("Skipped");
    expect(items[2]).toHaveTextContent("Skipped");
    expect(items[3]).toHaveTextContent("Done");
    expect(items.some((item) => item.hasAttribute("aria-current"))).toBe(false);
  });

  it("marks the clarifications done after a submission with a match, the review skipped without contestation", () => {
    const items = itemsFor("submitted", true, { matched: true, assessmentFinished: true, contested: false });

    expect(items[1]).toHaveTextContent("Done");
    expect(items[2]).toHaveTextContent("Skipped");
    expect(items[3]).toHaveTextContent("Done");
  });

  it("marks the review done after a submission with a contestation", () => {
    const items = itemsFor("submitted", true, { matched: true, assessmentFinished: true, contested: true });

    expect(items[1]).toHaveTextContent("Done");
    expect(items[2]).toHaveTextContent("Done");
    expect(items.some((item) => item.hasAttribute("aria-current"))).toBe(false);
  });

  it("marks the AI steps skipped and the last one done after a direct submission without questions", () => {
    const items = itemsFor("submitted", false);

    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Skipped");
    expect(items[1]).toHaveTextContent("Skipped");
    expect(items[2]).toHaveTextContent("Done");
  });
});
