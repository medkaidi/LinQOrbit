import { describe, expect, it } from "vitest";

import {
  buildAnswerRequests,
  draftsFromAnswers,
  emptyAnswerDrafts,
  invalidAnswerNumbers,
  isStorableAnswerNumber,
  toAnswerRequest,
  unansweredRequired,
  type AnswerDraft,
} from "@/features/application/answer-drafts";
import {
  MULTIPLE_CHOICE_QUESTION,
  NUMBER_QUESTION,
  SINGLE_CHOICE_QUESTION,
  TEXT_QUESTION,
  YES_NO_QUESTION,
} from "@/tests/helpers/application-fixtures";

function draft(overrides: Partial<AnswerDraft> = {}): AnswerDraft {
  return { text: "", number: "", yesNo: "", optionIds: [], ...overrides };
}

describe("isStorableAnswerNumber", () => {
  it("accepts integers, two-decimal values and negatives", () => {
    expect(isStorableAnswerNumber(7)).toBe(true);
    expect(isStorableAnswerNumber(7.5)).toBe(true);
    expect(isStorableAnswerNumber(-2.25)).toBe(true);
  });

  it("accepts two-decimal values that are inexact in binary floating point", () => {
    // Régression F1 : value * 100 donnait 28.999999999999996, 7.000000000000001, 110.00000000000001.
    expect(isStorableAnswerNumber(0.29)).toBe(true);
    expect(isStorableAnswerNumber(0.07)).toBe(true);
    expect(isStorableAnswerNumber(1.1)).toBe(true);
    expect(isStorableAnswerNumber(-0.29)).toBe(true);
    expect(isStorableAnswerNumber(0)).toBe(true);
  });

  it("accepts the bounds of NUMERIC(12,2) and refuses the next value", () => {
    expect(isStorableAnswerNumber(9_999_999_999.99)).toBe(true);
    expect(isStorableAnswerNumber(-9_999_999_999.99)).toBe(true);
    expect(isStorableAnswerNumber(10_000_000_000)).toBe(false);
  });

  it("refuses more than two decimals, including tiny values written with an exponent", () => {
    expect(isStorableAnswerNumber(0.001)).toBe(false);
    expect(isStorableAnswerNumber(1.005)).toBe(false);
    expect(isStorableAnswerNumber(1e-7)).toBe(false);
  });

  it("rejects non-finite values, more than two decimals and values beyond NUMERIC(12,2)", () => {
    expect(isStorableAnswerNumber(Number.NaN)).toBe(false);
    expect(isStorableAnswerNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isStorableAnswerNumber(1.005)).toBe(false);
    expect(isStorableAnswerNumber(10_000_000_000)).toBe(false);
    expect(isStorableAnswerNumber(-10_000_000_000)).toBe(false);
  });
});

describe("toAnswerRequest", () => {
  it("sends a trimmed text answer and omits a blank one", () => {
    expect(toAnswerRequest(TEXT_QUESTION, draft({ text: "  Hello  " }))).toEqual({
      questionId: TEXT_QUESTION.id,
      text: "Hello",
    });
    expect(toAnswerRequest(TEXT_QUESTION, draft({ text: "   " }))).toBeNull();
    expect(toAnswerRequest(TEXT_QUESTION, draft())).toBeNull();
  });

  it("parses a number answer and omits blank or non-storable ones", () => {
    expect(toAnswerRequest(NUMBER_QUESTION, draft({ number: "7.50" }))).toEqual({
      questionId: NUMBER_QUESTION.id,
      number: 7.5,
    });
    expect(toAnswerRequest(NUMBER_QUESTION, draft({ number: "" }))).toBeNull();
    expect(toAnswerRequest(NUMBER_QUESTION, draft({ number: "not-a-number" }))).toBeNull();
    expect(toAnswerRequest(NUMBER_QUESTION, draft({ number: "1.005" }))).toBeNull();
    // Saisies réelles à deux décimales, et zéros de fin retirés comme le backend (stripTrailingZeros).
    expect(toAnswerRequest(NUMBER_QUESTION, draft({ number: "0.29" }))).toEqual({
      questionId: NUMBER_QUESTION.id,
      number: 0.29,
    });
    expect(toAnswerRequest(NUMBER_QUESTION, draft({ number: "1.10" }))).toEqual({
      questionId: NUMBER_QUESTION.id,
      number: 1.1,
    });
  });

  it("maps yes/no drafts to booleans and omits the unanswered state", () => {
    expect(toAnswerRequest(YES_NO_QUESTION, draft({ yesNo: "yes" }))).toEqual({
      questionId: YES_NO_QUESTION.id,
      booleanValue: true,
    });
    expect(toAnswerRequest(YES_NO_QUESTION, draft({ yesNo: "no" }))).toEqual({
      questionId: YES_NO_QUESTION.id,
      booleanValue: false,
    });
    expect(toAnswerRequest(YES_NO_QUESTION, draft())).toBeNull();
  });

  it("sends selected options for both choice types and omits empty selections", () => {
    expect(toAnswerRequest(SINGLE_CHOICE_QUESTION, draft({ optionIds: ["opt-remote"] }))).toEqual({
      questionId: SINGLE_CHOICE_QUESTION.id,
      optionIds: ["opt-remote"],
    });
    expect(
      toAnswerRequest(MULTIPLE_CHOICE_QUESTION, draft({ optionIds: ["opt-java", "opt-kotlin"] })),
    ).toEqual({
      questionId: MULTIPLE_CHOICE_QUESTION.id,
      optionIds: ["opt-java", "opt-kotlin"],
    });
    expect(toAnswerRequest(SINGLE_CHOICE_QUESTION, draft())).toBeNull();
  });
});

describe("invalidAnswerNumbers", () => {
  it("flags only non-empty, non-storable number answers", () => {
    const questions = [NUMBER_QUESTION, TEXT_QUESTION];
    expect(
      invalidAnswerNumbers(questions, { [NUMBER_QUESTION.id]: draft({ number: "1.005" }) }),
    ).toEqual([NUMBER_QUESTION.label]);
    expect(
      invalidAnswerNumbers(questions, { [NUMBER_QUESTION.id]: draft({ number: "" }) }),
    ).toEqual([]);
    expect(
      invalidAnswerNumbers(questions, { [NUMBER_QUESTION.id]: draft({ number: "42.50" }) }),
    ).toEqual([]);
  });
});

describe("unansweredRequired", () => {
  it("lists only required questions without an answer", () => {
    const questions = [TEXT_QUESTION, SINGLE_CHOICE_QUESTION, MULTIPLE_CHOICE_QUESTION];
    const drafts = emptyAnswerDrafts(questions);

    expect(unansweredRequired(questions, drafts)).toEqual([
      TEXT_QUESTION.label,
      SINGLE_CHOICE_QUESTION.label,
    ]);

    drafts[TEXT_QUESTION.id] = draft({ text: "Ready" });
    drafts[SINGLE_CHOICE_QUESTION.id] = draft({ optionIds: ["opt-hybrid"] });
    expect(unansweredRequired(questions, drafts)).toEqual([]);
  });
});

describe("buildAnswerRequests", () => {
  it("keeps the question order and drops the empty answers", () => {
    const questions = [
      TEXT_QUESTION,
      SINGLE_CHOICE_QUESTION,
      MULTIPLE_CHOICE_QUESTION,
      YES_NO_QUESTION,
      NUMBER_QUESTION,
    ];
    const drafts = emptyAnswerDrafts(questions);
    drafts[TEXT_QUESTION.id] = draft({ text: "Hello" });
    drafts[YES_NO_QUESTION.id] = draft({ yesNo: "no" });
    drafts[NUMBER_QUESTION.id] = draft({ number: "3" });

    expect(buildAnswerRequests(questions, drafts)).toEqual([
      { questionId: TEXT_QUESTION.id, text: "Hello" },
      { questionId: YES_NO_QUESTION.id, booleanValue: false },
      { questionId: NUMBER_QUESTION.id, number: 3 },
    ]);
  });
});

describe("draftsFromAnswers", () => {
  it("prefills each question from its saved answer, by type", () => {
    const drafts = draftsFromAnswers(
      [TEXT_QUESTION, SINGLE_CHOICE_QUESTION, MULTIPLE_CHOICE_QUESTION, YES_NO_QUESTION, NUMBER_QUESTION],
      [
        { questionId: TEXT_QUESTION.id, label: "", type: "text", value: "Because" },
        { questionId: SINGLE_CHOICE_QUESTION.id, label: "", type: "single_choice",
          value: { optionId: "opt-remote", label: "Remote" } },
        { questionId: MULTIPLE_CHOICE_QUESTION.id, label: "", type: "multiple_choice",
          value: [{ optionId: "opt-java", label: "Java" }, { optionId: "opt-kotlin", label: "Kotlin" }] },
        { questionId: YES_NO_QUESTION.id, label: "", type: "yes_no", value: false },
        { questionId: NUMBER_QUESTION.id, label: "", type: "number", value: 7.5 },
      ],
    );

    expect(drafts[TEXT_QUESTION.id]).toEqual(draft({ text: "Because" }));
    expect(drafts[SINGLE_CHOICE_QUESTION.id]).toEqual(draft({ optionIds: ["opt-remote"] }));
    expect(drafts[MULTIPLE_CHOICE_QUESTION.id]).toEqual(draft({ optionIds: ["opt-java", "opt-kotlin"] }));
    expect(drafts[YES_NO_QUESTION.id]).toEqual(draft({ yesNo: "no" }));
    expect(drafts[NUMBER_QUESTION.id]).toEqual(draft({ number: "7.5" }));
  });

  it("leaves unanswered questions empty and ignores answers of unknown questions", () => {
    const drafts = draftsFromAnswers(
      [TEXT_QUESTION],
      [{ questionId: "gone", label: "", type: "text", value: "Old" }],
    );

    expect(drafts).toEqual({ [TEXT_QUESTION.id]: draft() });
  });

  it("round-trips a saved answer to the same request", () => {
    const answers = [{ questionId: YES_NO_QUESTION.id, label: "", type: "yes_no" as const, value: true }];

    expect(buildAnswerRequests([YES_NO_QUESTION], draftsFromAnswers([YES_NO_QUESTION], answers))).toEqual([
      { questionId: YES_NO_QUESTION.id, booleanValue: true },
    ]);
  });
});
