import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";

import { PublicJobView } from "@/features/job-offer/public-job-view";
import { getPublicJob, getRelatedPublicJobs } from "@/lib/api/public-jobs.api";
import type { PublicJob, PublicJobListItem } from "@/types/public-job";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

vi.mock("@/lib/api/public-jobs.api", () => ({
  getPublicJob: vi.fn(),
  listPublicJobs: vi.fn(),
  getRelatedPublicJobs: vi.fn(),
}));

const getPublicJobMock = vi.mocked(getPublicJob);
const getRelatedPublicJobsMock = vi.mocked(getRelatedPublicJobs);

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

function listItem(overrides: Partial<PublicJobListItem>): PublicJobListItem {
  return {
    publicId: "zyxwvutsrqpo",
    slug: "frontend-engineer",
    title: "Frontend Engineer",
    companyName: "Nimbus Labs",
    seniority: "mid",
    city: "Lyon",
    country: "FR",
    contractType: "Permanent",
    employmentType: "Full-time",
    workMode: "Hybrid",
    skills: [],
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    publishedAt: "2026-10-02T10:00:00",
    expiresAt: null,
    ...overrides,
  };
}

describe("PublicJobView", () => {
  it("renders the published offer with actions and the company's other offers", async () => {
    getPublicJobMock.mockResolvedValue(job);
    getRelatedPublicJobsMock.mockResolvedValue([listItem({})]);

    renderWithQueryClient(<PublicJobView jobParam="abcdefghijkl-backend-engineer" />);

    const hero = await screen.findByRole("region", { name: "Job overview" });
    expect(within(hero).getByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument();
    expect(within(hero).getByText("Nimbus Labs")).toBeInTheDocument();
    expect(within(hero).getByText("Paris, FR")).toBeInTheDocument();
    expect(within(hero).getByText("Remote")).toBeInTheDocument();

    expect(screen.getByText("Build our platform APIs.")).toBeInTheDocument();
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(screen.getByText(/French · B2/)).toBeInTheDocument();
    expect(screen.getByText("Bachelor's degree")).toBeInTheDocument();

    const applyLinks = screen.getAllByRole("link", { name: "Apply for this job" });
    expect(applyLinks).toHaveLength(2);
    for (const link of applyLinks) {
      expect(link).toHaveAttribute("href", "/jobs/abcdefghijkl-backend-engineer/apply");
    }

    expect(screen.getByRole("link", { name: "Back to offers" })).toHaveAttribute("href", "/jobs");
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();

    const related = await screen.findByRole("region", { name: "More from this company" });
    expect(within(related).getByRole("link", { name: /Frontend Engineer/ })).toHaveAttribute(
      "href",
      "/jobs/zyxwvutsrqpo-frontend-engineer",
    );
    expect(
      within(related).queryByRole("link", { name: /Backend Engineer/ }),
    ).not.toBeInTheDocument();

    expect(getPublicJobMock).toHaveBeenCalledWith("abcdefghijkl");
    expect(getRelatedPublicJobsMock).toHaveBeenCalledWith("abcdefghijkl", {
      signal: expect.anything(),
    });
  });

  it("shows the not-found state when the offer cannot be loaded", async () => {
    getPublicJobMock.mockRejectedValue(new Error("404"));

    renderWithQueryClient(<PublicJobView jobParam="abcdefghijkl-missing-offer" />);

    expect(await screen.findByRole("heading", { name: "Job not found" })).toBeInTheDocument();
    expect(getRelatedPublicJobsMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed param without calling the API", () => {
    getPublicJobMock.mockResolvedValue(job);

    renderWithQueryClient(<PublicJobView jobParam="nope" />);

    expect(screen.getByRole("heading", { name: "Job not found" })).toBeInTheDocument();
    expect(getPublicJobMock).not.toHaveBeenCalled();
    expect(getRelatedPublicJobsMock).not.toHaveBeenCalled();
  });
});
