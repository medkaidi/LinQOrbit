import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import { PublicJobView } from "@/features/job-offer/public-job-view";
import { getPublicJob } from "@/lib/api/public-jobs.api";
import type { PublicJob } from "@/types/public-job";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

vi.mock("@/lib/api/public-jobs.api", () => ({
  getPublicJob: vi.fn(),
}));

const getPublicJobMock = vi.mocked(getPublicJob);

const job: PublicJob = {
  publicId: "abcdefghijkl",
  slug: "backend-engineer",
  title: "Backend Engineer",
  description: "<p>Build our platform APIs.</p>",
  seniority: "mid",
  requiredExpYear: 3,
  city: "Paris",
  country: "FR",
  companyName: "Nimbus Labs",
  contractType: "Permanent",
  employmentType: "Full-time",
  workMode: "Remote",
  salaryMin: 50000,
  salaryMax: 70000,
  salaryCurrency: "EUR",
  salaryPeriod: "year",
  expiresAt: null,
  skills: [
    {
      skillId: "s1",
      name: "Java",
      requirementType: "mandatory",
      weight: 4,
      yearsExperience: null,
    },
  ],
  languages: [
    { languageId: "l1", symbol: "fr", name: "French", level: "B2", isRequired: true },
  ],
  degreeLabels: ["Bachelor's degree"],
  studyFieldLabels: [],
  publishedAt: "2026-10-01T10:00:00",
};

describe("PublicJobView", () => {
  it("renders the published offer fetched by publicId", async () => {
    getPublicJobMock.mockResolvedValue(job);

    renderWithQueryClient(<PublicJobView jobParam="abcdefghijkl-backend-engineer" />);

    expect(await screen.findByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument();
    expect(screen.getByText("Nimbus Labs")).toBeInTheDocument();
    expect(screen.getByText(/Paris, FR/)).toBeInTheDocument();
    expect(screen.getByText("Build our platform APIs.")).toBeInTheDocument();
    expect(screen.getByText(/Java/)).toBeInTheDocument();
    expect(screen.getByText(/French · B2/)).toBeInTheDocument();
    expect(screen.getByText("Bachelor's degree")).toBeInTheDocument();
    expect(getPublicJobMock).toHaveBeenCalledWith("abcdefghijkl");
  });

  it("shows the not-found state when the offer cannot be loaded", async () => {
    getPublicJobMock.mockRejectedValue(new Error("404"));

    renderWithQueryClient(<PublicJobView jobParam="abcdefghijkl-missing-offer" />);

    expect(await screen.findByRole("heading", { name: "Job not found" })).toBeInTheDocument();
  });

  it("rejects a malformed param without calling the API", () => {
    getPublicJobMock.mockResolvedValue(job);

    renderWithQueryClient(<PublicJobView jobParam="nope" />);

    expect(screen.getByRole("heading", { name: "Job not found" })).toBeInTheDocument();
    expect(getPublicJobMock).not.toHaveBeenCalled();
  });
});
