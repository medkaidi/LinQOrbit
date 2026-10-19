import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { RecruiterQuestionsStep } from "@/features/application/recruiter-questions-step";
import { saveApplicationDraft } from "@/lib/api/application.api";
import {
  buildApplication,
  buildApplicationContext,
  MULTIPLE_CHOICE_QUESTION,
  NUMBER_QUESTION,
  SINGLE_CHOICE_QUESTION,
  TEXT_QUESTION,
  YES_NO_QUESTION,
} from "@/tests/helpers/application-fixtures";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/api/application.api", () => ({
  getApplicationContext: vi.fn(),
  saveApplicationDraft: vi.fn(),
  submitApplication: vi.fn(),
  discardApplication: vi.fn(),
  listMyApplications: vi.fn(),
  withdrawApplication: vi.fn(),
}));

const saveMock = vi.mocked(saveApplicationDraft);

function renderStep(context = buildApplicationContext(), onContinue = vi.fn()) {
  renderWithQueryClient(<RecruiterQuestionsStep context={context} onContinue={onContinue} />);
  return onContinue;
}

function answerRequired() {
  fireEvent.change(screen.getByRole("textbox", { name: "Why this role?" }), { target: { value: "I love APIs" } });
  fireEvent.click(within(screen.getByRole("radiogroup", { name: "Preferred setup?" })).getByRole("radio", { name: "Remote" }));
}

describe("RecruiterQuestionsStep", () => {
  beforeEach(() => {
    saveMock.mockReset();
    pushMock.mockClear();
    saveMock.mockResolvedValue(buildApplication({ status: "draft" }));
  });

  it("saves every typed answer as a draft and continues once the required ones are answered", async () => {
    const onContinue = renderStep(
      buildApplicationContext({
        questions: [TEXT_QUESTION, SINGLE_CHOICE_QUESTION, MULTIPLE_CHOICE_QUESTION, YES_NO_QUESTION,
          NUMBER_QUESTION],
      }),
    );

    answerRequired();
    fireEvent.click(screen.getByRole("checkbox", { name: "Java" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Open to travel?" })).getByRole("radio", { name: "Yes" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Years of experience?" }), { target: { value: "7.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith({
        jobPublicId: "abcdefghijkl",
        answers: [
          { questionId: TEXT_QUESTION.id, text: "I love APIs" },
          { questionId: SINGLE_CHOICE_QUESTION.id, optionIds: ["opt-remote"] },
          { questionId: MULTIPLE_CHOICE_QUESTION.id, optionIds: ["opt-java"] },
          { questionId: YES_NO_QUESTION.id, booleanValue: true },
          { questionId: NUMBER_QUESTION.id, number: 7.5 },
        ],
      }),
    );
    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
  });

  it("saves a partial draft but stays on the step while a required question is unanswered", async () => {
    const onContinue = renderStep();

    fireEvent.change(screen.getByRole("textbox", { name: "Why this role?" }), { target: { value: "Only this one" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    expect(
      await screen.findByText("Your answers are saved. Still required to continue: Preferred setup?."),
    ).toBeInTheDocument();
    expect(saveMock).toHaveBeenCalledWith({
      jobPublicId: "abcdefghijkl",
      answers: [{ questionId: TEXT_QUESTION.id, text: "Only this one" }],
    });
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("saves a two-decimal number that floating point cannot represent exactly", async () => {
    renderStep(buildApplicationContext({ questions: [NUMBER_QUESTION] }));

    // Régression F1 : 0.29 était refusé à tort (« Answer for question … is invalid »).
    fireEvent.change(screen.getByRole("spinbutton", { name: "Years of experience?" }), { target: { value: "0.29" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith({
        jobPublicId: "abcdefghijkl",
        answers: [{ questionId: NUMBER_QUESTION.id, number: 0.29 }],
      }),
    );
    expect(screen.queryByText(/is invalid/)).not.toBeInTheDocument();
    expect(screen.getByText("1 of 1 answered")).toBeInTheDocument();
  });

  it("refuses a number that cannot be stored, without calling the server", async () => {
    renderStep(buildApplicationContext({ questions: [NUMBER_QUESTION] }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Years of experience?" }), { target: { value: "1.005" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    expect(await screen.findByText("Answer for question 'Years of experience?' is invalid.")).toBeInTheDocument();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("prefills the questions with the answers already saved", () => {
    renderStep(
      buildApplicationContext({
        questions: [TEXT_QUESTION, SINGLE_CHOICE_QUESTION],
        answers: buildApplication().answers,
      }),
    );

    expect(screen.getByRole("textbox", { name: "Why this role?" })).toHaveValue("I love APIs");
    expect(screen.getByRole("radio", { name: "Remote" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Hybrid" })).not.toBeChecked();
    expect(screen.getByText("2 of 2 answered")).toBeInTheDocument();
  });

  it("saves then leaves for My applications on Save and quit", async () => {
    renderStep();

    fireEvent.click(screen.getByRole("button", { name: "Save and quit" }));

    await waitFor(() => expect(saveMock).toHaveBeenCalledWith({ jobPublicId: "abcdefghijkl", answers: [] }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/applications"));
  });

  it("shows each question in its own numbered card with its required or optional status", () => {
    renderStep(buildApplicationContext({ questions: [TEXT_QUESTION, YES_NO_QUESTION] }));

    const first = screen.getByRole("region", { name: "Why this role?" });
    expect(within(first).getByText("1")).toBeInTheDocument();
    expect(within(first).getByText("Required")).toBeInTheDocument();
    expect(within(first).getByRole("textbox", { name: "Why this role?" })).toHaveAttribute("aria-required", "true");
    const second = screen.getByRole("region", { name: "Open to travel?" });
    expect(within(second).getByText("2")).toBeInTheDocument();
    expect(within(second).getByText("Optional")).toBeInTheDocument();
  });

  it("counts the answered questions as the candidate types and picks", () => {
    renderStep(buildApplicationContext({ questions: [TEXT_QUESTION, SINGLE_CHOICE_QUESTION, MULTIPLE_CHOICE_QUESTION] }));

    expect(screen.getByText("0 of 3 answered")).toBeInTheDocument();
    answerRequired();
    expect(screen.getByText("2 of 3 answered")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Java" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Kotlin" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Java" }));
    expect(screen.getByRole("checkbox", { name: "Kotlin" })).toBeChecked();
    expect(screen.getByText("3 of 3 answered")).toBeInTheDocument();
    // Une saisie vide ne compte pas comme une réponse.
    fireEvent.change(screen.getByRole("textbox", { name: "Why this role?" }), { target: { value: "   " } });
    expect(screen.getByText("2 of 3 answered")).toBeInTheDocument();
  });

  it("shows the server detail when the draft cannot be saved", async () => {
    saveMock.mockRejectedValue(
      Object.assign(new Error("conflict"), {
        isAxiosError: true,
        response: { status: 409, data: { detail: "You have already applied to this job offer." } },
      }),
    );
    const onContinue = renderStep();

    answerRequired();
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    expect(await screen.findByText("You have already applied to this job offer.")).toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("keeps a single option on a single-choice question when the candidate changes it", () => {
    renderStep(buildApplicationContext({ questions: [SINGLE_CHOICE_QUESTION] }));
    const group = screen.getByRole("radiogroup", { name: "Preferred setup?" });

    fireEvent.click(within(group).getByRole("radio", { name: "Remote" }));
    fireEvent.click(within(group).getByRole("radio", { name: "Hybrid" }));

    expect(within(group).getByRole("radio", { name: "Hybrid" })).toBeChecked();
    expect(within(group).getByRole("radio", { name: "Remote" })).not.toBeChecked();
  });

  it("flags a non-storable number on the field itself, and never leaves on Save and quit", async () => {
    renderStep(buildApplicationContext({ questions: [NUMBER_QUESTION] }));
    const field = screen.getByRole("spinbutton", { name: "Years of experience?" });

    fireEvent.change(field, { target: { value: "1.005" } });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Use a number below 10 billion with at most two decimals.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save and quit" }));

    expect(await screen.findByText("Answer for question 'Years of experience?' is invalid.")).toBeInTheDocument();
    expect(saveMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("clears the error alert once a later save succeeds", async () => {
    saveMock.mockRejectedValueOnce(
      Object.assign(new Error("boom"), { isAxiosError: true, response: { status: 404, data: { detail: "Gone." } } }),
    );
    renderStep(buildApplicationContext({ questions: [YES_NO_QUESTION] }));

    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(await screen.findByText("Gone.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(screen.queryByText("Gone.")).not.toBeInTheDocument());
  });

  it("continues when only optional questions are left unanswered", async () => {
    const onContinue = renderStep(buildApplicationContext({ questions: [YES_NO_QUESTION, NUMBER_QUESTION] }));

    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith({ jobPublicId: "abcdefghijkl", answers: [] });
  });
});
