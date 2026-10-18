import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { ApplyView } from "@/features/application/apply-view";
import { getApplicationContext, saveApplicationDraft } from "@/lib/api/application.api";
import { listCvs } from "@/lib/api/candidate.api";
import { getCurrentMatching } from "@/lib/api/matching.api";
import { getPublicJob } from "@/lib/api/public-jobs.api";
import {
  buildApplication,
  buildApplicationContext,
  buildCvAttachment,
  CV_ID,
} from "@/tests/helpers/application-fixtures";
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
}));

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return { ...actual, listCvs: vi.fn() };
});

const getContextMock = vi.mocked(getApplicationContext);
const saveMock = vi.mocked(saveApplicationDraft);
const getPublicJobMock = vi.mocked(getPublicJob);
const getMatchingMock = vi.mocked(getCurrentMatching);
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
  return within(screen.getByRole("navigation", { name: "Application progress" }))
    .getAllByRole("listitem")
    .find((item) => item.getAttribute("aria-current") === "step");
}

describe("ApplyView", () => {
  beforeEach(() => {
    getContextMock.mockReset();
    saveMock.mockReset();
    getPublicJobMock.mockReset();
    getMatchingMock.mockReset();
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
    expect(screen.getByLabelText("Why this role? *")).toBeInTheDocument();
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
    expect(currentStep()).toHaveTextContent("Match");
    const recap = screen.getByRole("region", { name: "Your answers" });
    expect(within(recap).getByText("I love APIs")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recruiter questions" })).not.toBeInTheDocument();
  });

  it("goes back to the recruiter questions on Edit answers, prefilled, then returns after saving", async () => {
    getContextMock.mockResolvedValue(matchingContext());
    saveMock.mockResolvedValue(buildApplication({ status: "draft" }));
    renderWithQueryClient(<ApplyView jobParam={JOB_PARAM} />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit answers" }));

    expect(screen.getByLabelText("Why this role? *")).toHaveValue("I love APIs");
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
});
