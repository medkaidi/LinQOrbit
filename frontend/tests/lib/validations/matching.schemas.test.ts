import { describe, expect, it } from "vitest";

import { assessmentFeedbackSchema } from "@/lib/validations/matching.schemas";

const row = (selfValue: string, comment = "") => ({ items: [{ criterionKey: "skill:java", selfValue, comment }] });

function messages(values: unknown): string[] {
  const result = assessmentFeedbackSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("assessmentFeedbackSchema", () => {
  it.each(["0", "7", "42", "100", ""])("accepts the score %j", (value) => {
    expect(assessmentFeedbackSchema.safeParse(row(value)).success).toBe(true);
  });

  it.each(["101", "-1", "50.5", "1e2", "007", "abc", " 5"])("rejects the score %j", (value) => {
    expect(messages(row(value))).toContain("Enter a whole number between 0 and 100");
  });

  it("accepts a comment of 2000 characters, trimmed, and rejects 2001", () => {
    const max = assessmentFeedbackSchema.safeParse(row("50", ` ${"a".repeat(2000)} `));
    expect(max.success).toBe(true);
    expect(messages(row("50", "a".repeat(2001)))).toEqual(["Comment must be 2000 characters or fewer"]);
  });

  it("asks for a score when a comment is given alone, never for a blank comment", () => {
    expect(messages(row("", "I use it daily"))).toEqual(["Enter your score to keep this comment"]);
    expect(messages(row("", "   "))).toEqual([]);
  });

  it("accepts an empty list", () => {
    expect(assessmentFeedbackSchema.safeParse({ items: [] }).success).toBe(true);
  });
});
