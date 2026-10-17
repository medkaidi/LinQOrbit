import { describe, expect, it } from "vitest";

import {
  buildAnswerRequests,
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
