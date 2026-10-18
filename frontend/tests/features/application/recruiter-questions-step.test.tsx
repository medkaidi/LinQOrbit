import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

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
  fireEvent.change(screen.getByLabelText("Why this role? *"), { target: { value: "I love APIs" } });
  fireEvent.click(screen.getByRole("combobox", { name: "Preferred setup? *" }));
  fireEvent.click(screen.getByRole("option", { name: "Remote" }));
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
    fireEvent.click(screen.getByRole("combobox", { name: "Open to travel?" }));
    fireEvent.click(screen.getByRole("option", { name: "Yes" }));
    fireEvent.change(screen.getByLabelText("Years of experience?"), { target: { value: "7.50" } });
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

    fireEvent.change(screen.getByLabelText("Why this role? *"), { target: { value: "Only this one" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    expect(
      await screen.findByText("Your answers are saved. Answer every required question (*) to continue."),
    ).toBeInTheDocument();
    expect(saveMock).toHaveBeenCalledWith({
      jobPublicId: "abcdefghijkl",
      answers: [{ questionId: TEXT_QUESTION.id, text: "Only this one" }],
    });
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("refuses a number that cannot be stored, without calling the server", async () => {
    renderStep(buildApplicationContext({ questions: [NUMBER_QUESTION] }));

    fireEvent.change(screen.getByLabelText("Years of experience?"), { target: { value: "1.005" } });
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

    expect(screen.getByLabelText("Why this role? *")).toHaveValue("I love APIs");
    expect(screen.getByRole("combobox", { name: "Preferred setup? *" })).toHaveTextContent("Remote");
  });

  it("saves then leaves for My applications on Save and quit", async () => {
    renderStep();

    fireEvent.click(screen.getByRole("button", { name: "Save and quit" }));

    await waitFor(() => expect(saveMock).toHaveBeenCalledWith({ jobPublicId: "abcdefghijkl", answers: [] }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/applications"));
  });

  it("continues at once on an offer without questions", async () => {
    const onContinue = renderStep(buildApplicationContext({ questions: [] }));

    expect(screen.getByText("The recruiter did not ask any question for this offer.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
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
});
