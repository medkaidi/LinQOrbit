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
import { buildClarification, buildMatching } from "@/tests/helpers/matching-fixtures";
import { buildPublicJob } from "@/tests/helpers/public-job-fixtures";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";
import type { ApplicationAssessment } from "@/types/application";

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

const NOT_MATCHED: ApplicationAssessment = {
  matched: false,
  assessmentOpen: false,
  assessmentFinished: false,
  contested: false,
};
const OPEN: ApplicationAssessment = {
  matched: true,
  assessmentOpen: true,
  assessmentFinished: false,
  contested: false,
};
const FINISHED: ApplicationAssessment = {
  matched: true,
  assessmentOpen: false,
  assessmentFinished: true,
  contested: false,
};

function matchingContext(assessment: ApplicationAssessment = NOT_MATCHED) {
  return buildApplicationContext({
    existingApplication: { id: "app-1", status: "draft", cvAttachmentId: CV_ID, createdAt: "2026-10-17T10:00:00" },
    answers: buildApplication().answers,
    step: "matching",
    canSubmit: true,
    assessment,
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

  it("shows the match and the summary side by side once the required answers are saved without a match", async () => {
    getContextMock.mockResolvedValue(matchingContext());

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    expect(await screen.findByRole("region", { name: "Your match" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Submit your application" })).toBeInTheDocument();
    // Sans matching, l'évaluation est sautée et le résumé est l'étape courante (D7).
    expect(currentStep()).toHaveTextContent("Summary & apply");
    const steps = within(screen.getByRole("region", { name: "Application progress" })).getAllByRole("listitem");
    expect(steps[1]).toHaveTextContent("Skipped");
    expect(steps[2]).toHaveTextContent("Skipped");
    const recap = screen.getByRole("region", { name: "Your answers" });
    expect(within(recap).getByText("I love APIs")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recruiter questions" })).not.toBeInTheDocument();
  });

  it("opens on the summary with three steps when the offer has no question and no match", async () => {
    getContextMock.mockResolvedValue(
      buildApplicationContext({ questions: [], existingApplication: null, answers: [], step: "matching", canSubmit: true }),
    );
    saveMock.mockResolvedValue(buildApplication({ id: "app-new", status: "draft", answers: [] }));
    startMatchingMock.mockResolvedValue(buildMatching());

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    expect(await screen.findByRole("region", { name: "Your match" })).toBeInTheDocument();
    const steps = within(screen.getByRole("region", { name: "Application progress" })).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(currentStep()).toHaveTextContent("Step 3Summary & apply");
    expect(screen.getByRole("region", { name: "Submit your application" })).toBeInTheDocument();
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

  it("hides the submission and shows a loader while the assessment is being analysed", async () => {
    getContextMock.mockResolvedValue(matchingContext(OPEN));
    getMatchingMock.mockResolvedValue(buildMatching({ status: "running" }));

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    expect(await screen.findByRole("region", { name: "Assessment in progress" })).toBeInTheDocument();
    expect(screen.getByText("Analyzing your application…")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Submit your application" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your answers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your assessment" })).not.toBeInTheDocument();
    expect(currentStep()).toHaveTextContent("AI clarifications");
  });

  it("shows the AI question in the central column, outside the match panel, while the assessment is open", async () => {
    getContextMock.mockResolvedValue(matchingContext(OPEN));
    getMatchingMock.mockResolvedValue(
      buildMatching({
        status: "done",
        clarification: buildClarification(),
        sections: [{ section: "required_skills", criteria: [{ key: "skill:java", label: "Java", score: 80 }] }],
      }),
    );

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    const clarification = await screen.findByRole("region", { name: "AI clarification" });
    const match = screen.getByRole("region", { name: "Your match" });
    expect(match).not.toContainElement(clarification);
    expect(screen.queryByRole("region", { name: "Submit your application" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your answers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your assessment" })).not.toBeInTheDocument();
    expect(currentStep()).toHaveTextContent("AI clarifications");
  });

  it("reports a failed analysis without reopening the submission", async () => {
    getContextMock.mockResolvedValue(matchingContext(OPEN));
    getMatchingMock.mockResolvedValue(buildMatching({ status: "failed" }));
    startMatchingMock.mockResolvedValue(buildMatching({ status: "pending" }));

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    expect(await screen.findByRole("region", { name: "Assessment failed" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Submit your application" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run the match again" }));
    await waitFor(() => expect(startMatchingMock).toHaveBeenCalledWith("abcdefghijkl"));
  });

  it("hides the submission as soon as the match is launched and the journey context confirms it", async () => {
    getContextMock.mockResolvedValueOnce(matchingContext()).mockResolvedValue(matchingContext(OPEN));
    startMatchingMock.mockResolvedValue(buildMatching({ status: "pending" }));

    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    expect(await screen.findByRole("region", { name: "Submit your application" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Run the match" }));

    await waitFor(() => expect(getContextMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("region", { name: "Assessment in progress" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Submit your application" })).not.toBeInTheDocument();
    expect(currentStep()).toHaveTextContent("AI clarifications");
  });

  it("shows the candidate review first, on the current step, once the assessment is finished", async () => {
    getContextMock.mockResolvedValue(matchingContext(FINISHED));
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

  it("hides the candidate review and the submission while the assessment is still open", async () => {
    getContextMock.mockResolvedValue(matchingContext(OPEN));
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
    expect(screen.queryByRole("region", { name: "Submit your application" })).not.toBeInTheDocument();
    expect(currentStep()).toHaveTextContent("AI clarifications");
  });

  it("re-reads the journey context when the match closes the assessment by itself", async () => {
    getContextMock.mockResolvedValue(matchingContext(OPEN));
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
        assessment: { ...FINISHED, contested: true },
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
