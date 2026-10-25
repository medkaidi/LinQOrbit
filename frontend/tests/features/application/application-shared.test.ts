import { describe, expect, it } from "vitest";

import {
  APPLICATION_STATUS_TONES,
  answerValueLabel,
  appliedOnLabel,
} from "@/features/application/application-shared";
import type { ApplicationAnswerView } from "@/types/application";

const base = { questionId: "q1", label: "Question" } as const;

describe("appliedOnLabel", () => {
  it("renders a medium english date", () => {
    expect(appliedOnLabel("2026-10-17T10:00:00")).toBe("Oct 17, 2026");
  });

  it("returns null for an unreadable or empty date", () => {
    expect(appliedOnLabel("not-a-date")).toBeNull();
    expect(appliedOnLabel("")).toBeNull();
  });
});

describe("answerValueLabel", () => {
  it.each<[string, ApplicationAnswerView, string]>([
    ["text", { ...base, type: "text", value: "Because" }, "Because"],
    ["empty text", { ...base, type: "text", value: "" }, ""],
    ["zero", { ...base, type: "number", value: 0 }, "0"],
    ["decimal", { ...base, type: "number", value: 4.5 }, "4.5"],
    ["yes", { ...base, type: "yes_no", value: true }, "Yes"],
    ["no", { ...base, type: "yes_no", value: false }, "No"],
    [
      "single choice",
      { ...base, type: "single_choice", value: { optionId: "o1", label: "Remote" } },
      "Remote",
    ],
    [
      "multiple choice",
      {
        ...base,
        type: "multiple_choice",
        value: [
          { optionId: "o1", label: "Java" },
          { optionId: "o2", label: "Kotlin" },
        ],
      },
      "Java, Kotlin",
    ],
    ["empty multiple choice", { ...base, type: "multiple_choice", value: [] }, ""],
  ])("renders a %s answer", (_name, answer, expected) => {
    expect(answerValueLabel(answer)).toBe(expected);
  });
});

describe("APPLICATION_STATUS_TONES", () => {
  it("gives every status the dot colour that also draws its dashboard bar", () => {
    expect(Object.keys(APPLICATION_STATUS_TONES).sort()).toEqual(
      ["accepted", "draft", "rejected", "submitted", "withdrawn"],
    );
    for (const tone of Object.values(APPLICATION_STATUS_TONES)) {
      expect(tone.dot).toMatch(/^bg-/);
    }
  });
});
