import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClarificationPanel } from "@/features/matching/clarification-panel";
import { answerClarification, finishAssessment, skipClarification } from "@/lib/api/matching.api";
import { buildClarification, buildMatching } from "@/tests/helpers/matching-fixtures";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

vi.mock("@/lib/api/matching.api", () => ({
  getCurrentMatching: vi.fn(),
  answerClarification: vi.fn(),
  skipClarification: vi.fn(),
  finishAssessment: vi.fn(),
}));

const answerMock = vi.mocked(answerClarification);
const skipMock = vi.mocked(skipClarification);
const finishMock = vi.mocked(finishAssessment);
const PUBLIC_ID = "abcdefghijkl";
const CLARIFICATION = buildClarification();

function httpError(status: number, detail?: string) {
  return Object.assign(new Error(String(status)), {
    isAxiosError: true,
    response: { status, data: detail ? { detail } : {} },
  });
}

function renderAsked(remainingQuestions = CLARIFICATION.remainingQuestions) {
  return renderWithQueryClient(
    <ClarificationPanel
      publicId={PUBLIC_ID}
      matching={buildMatching({ status: "done", clarification: { ...CLARIFICATION, remainingQuestions } })}
    />,
  );
}

function typeAnswer(value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value } });
}

describe("ClarificationPanel", () => {
  beforeEach(() => {
    answerMock.mockReset();
    skipMock.mockReset();
    finishMock.mockReset();
  });

  it("shows the open question, why it is asked and how many may follow", () => {
    renderAsked();

    const panel = screen.getByRole("region", { name: "AI clarification" });
    expect(within(panel).getByText(CLARIFICATION.question)).toBeInTheDocument();
    expect(within(panel).getByText(CLARIFICATION.rationale!)).toBeInTheDocument();
    expect(within(panel).getByText("Question 1")).toBeInTheDocument();
    expect(within(panel).getByText("Up to 2 more questions")).toBeInTheDocument();
  });

  it("shows the question rank and omits the rationale callout when the AI supplied none", () => {
    renderWithQueryClient(
      <ClarificationPanel
        publicId={PUBLIC_ID}
        matching={buildMatching({
          status: "done",
          clarification: buildClarification({ questionNumber: 3, rationale: null }),
        })}
      />,
    );

    expect(screen.getByText("Question 3")).toBeInTheDocument();
    expect(screen.queryByText("Why this question")).not.toBeInTheDocument();
  });

  it("words the counter for the last and the penultimate question", () => {
    const { unmount } = renderAsked(0);
    expect(screen.getByText("Last question")).toBeInTheDocument();
    unmount();

    renderAsked(1);
    expect(screen.getByText("Up to 1 more question")).toBeInTheDocument();
  });

  it("sends the trimmed answer and locks every action while it is sent", async () => {
    let resolve: (value: ReturnType<typeof buildMatching>) => void = () => {};
    answerMock.mockReturnValue(new Promise((done) => (resolve = done)));
    renderAsked();

    typeAnswer("  Yes, two years on GKE.  ");
    fireEvent.click(screen.getByRole("button", { name: "Send answer" }));

    await waitFor(() =>
      expect(answerMock).toHaveBeenCalledWith(PUBLIC_ID, CLARIFICATION.id, "Yes, two years on GKE."),
    );
    expect(screen.getByRole("button", { name: "Send answer" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Pass this question" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Finish the assessment" })).toBeDisabled();
    resolve(buildMatching());
    await waitFor(() => expect(screen.getByRole("button", { name: "Send answer" })).toBeEnabled());
  });

  it("blocks an empty or blank answer without calling the server", () => {
    renderAsked();

    fireEvent.click(screen.getByRole("button", { name: "Send answer" }));
    expect(screen.getByText("Write an answer, or pass this question.")).toBeInTheDocument();

    typeAnswer("    ");
    fireEvent.click(screen.getByRole("button", { name: "Send answer" }));

    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveAttribute("aria-invalid", "true");
    expect(answerMock).not.toHaveBeenCalled();
  });

  it("caps the answer at 3000 characters and counts them", () => {
    renderAsked();

    const field = screen.getByRole("textbox", { name: "Your answer" });
    expect(field).toHaveAttribute("maxLength", "3000");
    typeAnswer("Kubernetes");
    expect(screen.getByText("10 / 3000")).toBeInTheDocument();
  });

  it("passes the question", async () => {
    skipMock.mockResolvedValue(buildMatching());
    renderAsked();

    fireEvent.click(screen.getByRole("button", { name: "Pass this question" }));

    await waitFor(() => expect(skipMock).toHaveBeenCalledWith(PUBLIC_ID, CLARIFICATION.id));
    expect(answerMock).not.toHaveBeenCalled();
  });

  it("finishes the assessment only after confirmation", async () => {
    finishMock.mockResolvedValue(undefined);
    renderAsked();

    fireEvent.click(screen.getByRole("button", { name: "Finish the assessment" }));
    const dialog = screen.getByRole("dialog", { name: "Finish the assessment?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(finishMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Finish the assessment" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(finishMock).toHaveBeenCalledWith(PUBLIC_ID));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the server detail when the answer is refused", async () => {
    answerMock.mockRejectedValue(httpError(409, "This question is already closed."));
    renderAsked();

    typeAnswer("Yes");
    fireEvent.click(screen.getByRole("button", { name: "Send answer" }));

    expect(await screen.findByText("Could not send your answer")).toBeInTheDocument();
    expect(screen.getByText("This question is already closed.")).toBeInTheDocument();
  });

  it("shows the server detail when the assessment cannot be finished, and only the last failure", async () => {
    skipMock.mockRejectedValue(httpError(409, "An analysis is running."));
    finishMock.mockRejectedValue(httpError(409, "An analysis is still running."));
    renderAsked();

    fireEvent.click(screen.getByRole("button", { name: "Pass this question" }));
    expect(await screen.findByText("Could not pass this question")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Finish the assessment" }));
    expect(screen.queryByText("Could not pass this question")).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Finish" }));

    expect(await screen.findByText("An analysis is still running.")).toBeInTheDocument();
    expect(screen.getByText("Could not finish the assessment")).toBeInTheDocument();
  });

  it("tells when the assessment is complete — no question, no action", () => {
    renderWithQueryClient(
      <ClarificationPanel publicId={PUBLIC_ID} matching={buildMatching({ status: "done", assessmentFinished: true })} />,
    );

    expect(screen.getByText("Assessment complete")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send answer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finish the assessment" })).not.toBeInTheDocument();
  });

  it("lets the candidate finish when no question is open on a still-open assessment (match analysed before T-62)", async () => {
    finishMock.mockResolvedValue(undefined);
    renderWithQueryClient(<ClarificationPanel publicId={PUBLIC_ID} matching={buildMatching({ status: "done" })} />);

    expect(screen.getByText("No AI question is waiting for you.")).toBeInTheDocument();
    expect(screen.queryByText(/Preparing/)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Your answer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send answer" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Finish the assessment" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Finish the assessment?" })).getByRole("button", { name: "Cancel" }));
    expect(finishMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Finish the assessment" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(finishMock).toHaveBeenCalledWith(PUBLIC_ID));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the server detail when finishing fails without an open question", async () => {
    finishMock.mockRejectedValue(httpError(409, "An analysis is still running."));
    renderWithQueryClient(<ClarificationPanel publicId={PUBLIC_ID} matching={buildMatching({ status: "done" })} />);

    fireEvent.click(screen.getByRole("button", { name: "Finish the assessment" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Finish" }));

    expect(await screen.findByText("Could not finish the assessment")).toBeInTheDocument();
    expect(screen.getByText("An analysis is still running.")).toBeInTheDocument();
  });

  it("starts a blank form for a new question", () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { rerender } = render(
      <ClarificationPanel publicId={PUBLIC_ID} matching={buildMatching({ status: "done", clarification: CLARIFICATION })} />,
      { wrapper },
    );
    typeAnswer("Draft for the first question");

    rerender(
      <ClarificationPanel
        publicId={PUBLIC_ID}
        matching={buildMatching({
          status: "done",
          clarification: buildClarification({ id: "c2", question: "Do you lead a team?" }),
        })}
      />,
    );

    expect(screen.getByText("Do you lead a team?")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  });
});
