import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { ApplyView } from "@/features/application/apply-view";
import { getApplicationContext, saveApplicationDraft, submitApplication } from "@/lib/api/application.api";
import { listCvs } from "@/lib/api/candidate.api";
import { getCurrentMatching, startMatching } from "@/lib/api/matching.api";
import { getPublicJob } from "@/lib/api/public-jobs.api";
import {
  buildApplication,
  buildApplicationContext,
  buildCvAttachment,
  CV_ID,
} from "@/tests/helpers/application-fixtures";
import { buildMatching } from "@/tests/helpers/matching-fixtures";
import { buildPublicJob } from "@/tests/helpers/public-job-fixtures";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api/application.api", () => ({
  getApplicationContext: vi.fn(),
  saveApplicationDraft: vi.fn(),
  submitApplication: vi.fn(),
  discardApplication: vi.fn(),
  listMyApplications: vi.fn(),
  withdrawApplication: vi.fn(),
}));

vi.mock("@/lib/api/public-jobs.api", () => ({
  getPublicJob: vi.fn(),
  getRelatedPublicJobs: vi.fn(),
  listPublicJobs: vi.fn(),
}));

vi.mock("@/lib/api/matching.api", () => ({
  getCurrentMatching: vi.fn(),
  startMatching: vi.fn(),
  streamMatchingStatus: vi.fn(() => new Promise(() => {})),
}));

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return { ...actual, listCvs: vi.fn() };
});

const getContextMock = vi.mocked(getApplicationContext);
const saveMock = vi.mocked(saveApplicationDraft);
const getPublicJobMock = vi.mocked(getPublicJob);
const getMatchingMock = vi.mocked(getCurrentMatching);
const startMatchingMock = vi.mocked(startMatching);
const listCvsMock = vi.mocked(listCvs);
const JOB_PARAM = "abcdefghijkl-backend-engineer";
const NOT_FOUND = Object.assign(new Error("404"), { isAxiosError: true, response: { status: 404, data: {} } });

function matchingContext() {
  return buildApplicationContext({
    existingApplication: { id: "app-1", status: "draft", cvAttachmentId: CV_ID, createdAt: "2026-10-17T10:00:00" },
    answers: buildApplication().answers,
    step: "matching",
    canSubmit: true,
  });
}

function currentStep() {
  return within(screen.getByRole("region", { name: "Application progress" }))
    .getAllByRole("listitem")
    .find((item) => item.getAttribute("aria-current") === "step");
}

describe("ApplyView", () => {
  beforeEach(() => {
    getContextMock.mockReset();
    saveMock.mockReset();
    getPublicJobMock.mockReset();
    getMatchingMock.mockReset();
    startMatchingMock.mockReset();
    listCvsMock.mockReset();
    getPublicJobMock.mockResolvedValue(buildPublicJob());
    getMatchingMock.mockRejectedValue(NOT_FOUND);
    listCvsMock.mockResolvedValue([buildCvAttachment()]);
  });

  it("rejects a malformed job param without calling the API", () => {
    renderWithQueryClient(<ApplyView jobParam="nope" />);

    expect(screen.getByRole("heading", { name: "Job not found" })).toBeInTheDocument();
    expect(getContextMock).not.toHaveBeenCalled();
  });

  it("shows the not-found state when the offer is no longer available", async () => {
    getContextMock.mockRejectedValue(new Error("404"));

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    expect(await screen.findByRole("heading", { name: "Job not found" })).toBeInTheDocument();
  });

  it("starts on the recruiter questions with the offer banner and the progress indicator", async () => {
    getContextMock.mockResolvedValue(buildApplicationContext());

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    expect(await screen.findByRole("heading", { name: "Recruiter questions" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Why this role?" })).toBeInTheDocument();
    expect(currentStep()).toHaveTextContent("Recruiter questions");
    expect(await screen.findByRole("region", { name: "Job offer summary" })).toBeInTheDocument();
    // Ni matching ni transmission tant que les obligatoires manquent.
    expect(screen.queryByRole("region", { name: "Your match" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit application" })).not.toBeInTheDocument();
  });

  it("shows the match and the submit panel side by side once the required answers are saved", async () => {
    getContextMock.mockResolvedValue(matchingContext());

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    expect(await screen.findByRole("region", { name: "Your match" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Submit your application" })).toBeInTheDocument();
    expect(currentStep()).toHaveTextContent("AI clarifications");
    const recap = screen.getByRole("region", { name: "Your answers" });
    expect(within(recap).getByText("I love APIs")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recruiter questions" })).not.toBeInTheDocument();
  });

  it("opens directly on the AI clarifications with three steps when the offer has no question", async () => {
    getContextMock.mockResolvedValue(
      buildApplicationContext({ questions: [], existingApplication: null, answers: [], step: "matching", canSubmit: true }),
    );
    saveMock.mockResolvedValue(buildApplication({ id: "app-new", status: "draft", answers: [] }));
    startMatchingMock.mockResolvedValue(buildMatching());

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    expect(await screen.findByRole("region", { name: "Your match" })).toBeInTheDocument();
    const steps = within(screen.getByRole("region", { name: "Application progress" })).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(currentStep()).toHaveTextContent("Step 1AI clarifications");
    // Ni formulaire de questions, ni rappel de réponses : il n'y a rien à répondre.
    expect(screen.queryByRole("heading", { name: "Recruiter questions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your answers" })).not.toBeInTheDocument();
    // Aucun brouillon tant que le candidat n'agit pas.
    expect(saveMock).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Run the match" }));

    await waitFor(() => expect(startMatchingMock).toHaveBeenCalledWith("abcdefghijkl"));
    expect(saveMock).toHaveBeenCalledWith({ jobPublicId: "abcdefghijkl", answers: [] });
    expect(saveMock.mock.invocationCallOrder[0]).toBeLessThan(startMatchingMock.mock.invocationCallOrder[0]);
  });

  it("goes back to the recruiter questions on Edit answers, prefilled, then returns after saving", async () => {
    getContextMock.mockResolvedValue(matchingContext());
    saveMock.mockResolvedValue(buildApplication({ status: "draft" }));
    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit answers" }));

    expect(screen.getByRole("textbox", { name: "Why this role?" })).toHaveValue("I love APIs");
    expect(screen.queryByRole("region", { name: "Your match" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(await screen.findByRole("region", { name: "Your match" })).toBeInTheDocument();
  });

  it("switches to the already-applied state once the application is submitted", async () => {
    getContextMock.mockResolvedValue(
      buildApplicationContext({
        existingApplication: { id: "app-1", status: "submitted", cvAttachmentId: CV_ID,
          createdAt: "2026-10-10T09:30:00" },
        step: "submitted",
      }),
    );

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    expect(await screen.findByText(/You have already applied to this job offer/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View my applications" })).toHaveAttribute("href", "/applications");
    expect(screen.queryByRole("heading", { name: "Recruiter questions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your match" })).not.toBeInTheDocument();
    expect(getMatchingMock).not.toHaveBeenCalled();
  });

  it("shows the candidate review first, on the current step, once the assessment is finished", async () => {
    getContextMock.mockResolvedValue({
      ...matchingContext(),
      assessment: { matched: true, assessmentFinished: true, contested: false },
    });
    getMatchingMock.mockResolvedValue(
      buildMatching({
        status: "done",
        assessmentFinished: true,
        sections: [{ section: "required_skills", criteria: [{ key: "skill:java", label: "Java", score: 80 }] }],
      }),
    );

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    const review = await screen.findByRole("region", { name: "Your assessment" });
    expect(within(review).getByRole("spinbutton", { name: "Your score for Java" })).toBeInTheDocument();
    expect(currentStep()).toHaveTextContent("Candidate review");
    // Revue avant transmission : la carte précède le panneau d'envoi.
    expect(
      review.compareDocumentPosition(screen.getByRole("region", { name: "Submit your application" })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("hides the candidate review while the assessment is still open", async () => {
    getContextMock.mockResolvedValue(matchingContext());
    getMatchingMock.mockResolvedValue(
      buildMatching({
        status: "done",
        sections: [{ section: "required_skills", criteria: [{ key: "skill:java", label: "Java", score: 80 }] }],
        clarification: { id: "c-1", question: "Used Java 21?", rationale: "Recent versions matter.", remainingQuestions: 1 },
      }),
    );

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    expect(await screen.findByRole("region", { name: "AI clarification" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your assessment" })).not.toBeInTheDocument();
    expect(currentStep()).toHaveTextContent("AI clarifications");
  });

  it("re-reads the journey context when the match closes the assessment by itself", async () => {
    getContextMock.mockResolvedValue(matchingContext());
    getMatchingMock.mockResolvedValue(buildMatching({ status: "done", assessmentFinished: true }));

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    // Le matching (clos) contredit le contexte (ouvert) : le contexte se relit, une seule fois.
    await waitFor(() => expect(getContextMock).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getContextMock).toHaveBeenCalledTimes(2);
  });

  it("shows the steps done after a submission with a contested match", async () => {
    getContextMock.mockResolvedValue(
      buildApplicationContext({
        existingApplication: { id: "app-1", status: "submitted", cvAttachmentId: CV_ID, createdAt: "2026-10-10T09:30:00" },
        step: "submitted",
        assessment: { matched: true, assessmentFinished: true, contested: true },
      }),
    );

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    expect(await screen.findByText(/You have already applied to this job offer/)).toBeInTheDocument();
    const steps = within(screen.getByRole("region", { name: "Application progress" })).getAllByRole("listitem");
    expect(steps.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Done"),
      expect.stringContaining("Done"),
      expect.stringContaining("Done"),
      expect.stringContaining("Done"),
    ]);
    expect(screen.queryByRole("region", { name: "Your assessment" })).not.toBeInTheDocument();
    expect(getMatchingMock).not.toHaveBeenCalled();
  });

  it("creates a single draft when the candidate runs the match then submits at once", async () => {
    getContextMock.mockResolvedValue(
      buildApplicationContext({ questions: [], existingApplication: null, answers: [], step: "matching", canSubmit: true }),
    );
    let createDraft: (value: ReturnType<typeof buildApplication>) => void = () => {};
    saveMock.mockReturnValue(new Promise((resolve) => (createDraft = resolve)));
    startMatchingMock.mockResolvedValue(buildMatching());
    vi.mocked(submitApplication).mockResolvedValue(buildApplication());

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);
    fireEvent.click(await screen.findByRole("button", { name: "Run the match" }));
    const submit = screen.getByRole("button", { name: "Submit application" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    createDraft(buildApplication({ id: "app-new", status: "draft", answers: [] }));

    await waitFor(() => expect(vi.mocked(submitApplication)).toHaveBeenCalledWith("app-new", expect.anything()));
    expect(saveMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(startMatchingMock).toHaveBeenCalledTimes(1));
  });
});
