import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import { ApplicationForm } from "@/features/application/application-form";
import { submitApplication } from "@/lib/api/application.api";
import { listCvs } from "@/lib/api/candidate.api";
import {
  buildApplication,
  buildApplicationContext,
  buildCvAttachment,
  CV_ID,
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
  submitApplication: vi.fn(),
  listMyApplications: vi.fn(),
  withdrawApplication: vi.fn(),
}));

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return { ...actual, listCvs: vi.fn() };
});

const submitMock = vi.mocked(submitApplication);
const listCvsMock = vi.mocked(listCvs);

async function renderForm(context = buildApplicationContext()) {
  renderWithQueryClient(<ApplicationForm context={context} />);
  const button = await screen.findByRole("button", { name: "Submit application" });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe("ApplicationForm", () => {
  beforeEach(() => {
    submitMock.mockReset();
    listCvsMock.mockReset();
    pushMock.mockClear();
    listCvsMock.mockResolvedValue([buildCvAttachment()]);
  });

  it("blocks submission while required questions are unanswered", async () => {
    const button = await renderForm();

    fireEvent.click(button);

    expect(await screen.findByText("All required questions must be answered.")).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("blocks submission when a number answer is not storable", async () => {
    const button = await renderForm(
      buildApplicationContext({ questions: [NUMBER_QUESTION] }),
    );

    fireEvent.change(screen.getByLabelText("Years of experience?"), {
      target: { value: "1.005" },
    });
    fireEvent.click(button);

    expect(
      await screen.findByText("Answer for question 'Years of experience?' is invalid."),
    ).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("submits the answers typed by the candidate and redirects to the applications page", async () => {
    submitMock.mockResolvedValue(buildApplication());
    const button = await renderForm(
      buildApplicationContext({
        questions: [
          TEXT_QUESTION,
          SINGLE_CHOICE_QUESTION,
          MULTIPLE_CHOICE_QUESTION,
          YES_NO_QUESTION,
          NUMBER_QUESTION,
        ],
      }),
    );

    fireEvent.change(screen.getByLabelText("Why this role? *"), {
      target: { value: "I love APIs" },
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Preferred setup? *" }));
    fireEvent.click(screen.getByRole("option", { name: "Remote" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Java" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Open to travel?" }));
    fireEvent.click(screen.getByRole("option", { name: "Yes" }));
    fireEvent.change(screen.getByLabelText("Years of experience?"), { target: { value: "7.50" } });
    fireEvent.click(button);

    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith({
        jobPublicId: "abcdefghijkl",
        cvAttachmentId: CV_ID,
        answers: [
          { questionId: TEXT_QUESTION.id, text: "I love APIs" },
          { questionId: SINGLE_CHOICE_QUESTION.id, optionIds: ["opt-remote"] },
          { questionId: MULTIPLE_CHOICE_QUESTION.id, optionIds: ["opt-java"] },
          { questionId: YES_NO_QUESTION.id, booleanValue: true },
          { questionId: NUMBER_QUESTION.id, number: 7.5 },
        ],
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/applications"));
  });

  it("shows the server detail when the submission is rejected", async () => {
    submitMock.mockRejectedValue(
      Object.assign(new Error("conflict"), {
        isAxiosError: true,
        response: {
          status: 409,
          data: { detail: "You have already applied to this job offer." },
        },
      }),
    );
    const button = await renderForm();

    fireEvent.change(screen.getByLabelText("Why this role? *"), {
      target: { value: "I love APIs" },
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Preferred setup? *" }));
    fireEvent.click(screen.getByRole("option", { name: "Remote" }));
    fireEvent.click(button);

    expect(await screen.findByText("Submission failed")).toBeInTheDocument();
    expect(screen.getByText("You have already applied to this job offer.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("requires a CV before the application can be submitted", async () => {
    listCvsMock.mockResolvedValue([]);
    renderWithQueryClient(<ApplicationForm context={buildApplicationContext()} />);

    expect(await screen.findByText("A CV is required")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "go to your profile" })).toHaveAttribute(
      "href",
      "/profile/edit",
    );
    expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
  });
});
