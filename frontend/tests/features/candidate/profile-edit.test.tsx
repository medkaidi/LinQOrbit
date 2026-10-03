import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return {
    ...actual,
    getProfile: vi.fn(),
    getReferenceSkills: vi.fn(),
    getReferenceLanguages: vi.fn(),
    getReferenceDegrees: vi.fn(),
    getReferenceStudyFields: vi.fn(),
  };
});

import {
  getProfile,
  getReferenceDegrees,
  getReferenceLanguages,
  getReferenceSkills,
  getReferenceStudyFields,
  type CandidateProfile,
} from "@/lib/api/candidate.api";
import { ProfileEdit } from "@/features/candidate/profile-edit";

const mockedGetProfile = vi.mocked(getProfile);
const mockedReferenceQueries = [
  vi.mocked(getReferenceSkills),
  vi.mocked(getReferenceLanguages),
  vi.mocked(getReferenceDegrees),
  vi.mocked(getReferenceStudyFields),
];

const profile: CandidateProfile = {
  about: {
    title: "Backend Engineer",
    bio: "I build APIs that scale.",
    yearsOfExperience: 5,
    searchStatus: "open_to_work",
  },
  experiences: [
    {
      id: "e1",
      positionTitle: "Backend Engineer",
      description: null,
      startDate: "2023-04-01",
      endDate: null,
      companyName: "Acme",
      companyCountry: "FR",
    },
  ],
  diplomas: [],
  skills: [],
  languages: [],
  links: [],
  completionPercentage: 33,
};

function renderProfile(options?: { retry?: boolean }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: options?.retry ?? false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileEdit />
    </QueryClientProvider>,
  );
}

describe("ProfileEdit", () => {
  beforeEach(() => {
    mockedGetProfile.mockReset();
    mockedGetProfile.mockResolvedValue(profile);
    mockedReferenceQueries.forEach((query) => {
      query.mockReset();
      query.mockResolvedValue([]);
    });
  });

  it("renders every section with its completion state and the completion bar", async () => {
    renderProfile();

    expect(
      await screen.findByText("2 of 6 sections complete. A profile with substance gets more replies."),
    ).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();

    const progressbar = screen.getByRole("progressbar", { name: "Profile completeness" });
    expect(progressbar).toHaveAttribute("aria-valuenow", "33");

    for (const title of ["About", "Experience", "Education", "Skills", "Languages", "Links & certifications"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }

    expect(screen.getAllByText("Complete")).toHaveLength(2);
    expect(screen.getAllByText("Not started")).toHaveLength(4);
  });

  it("keeps the CV and photo actions unavailable", async () => {
    renderProfile();

    for (const name of ["Upload CV", "Add photo"]) {
      const button = await screen.findByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAttribute("title", "Coming soon");
    }
  });

  it("links back to the display page", async () => {
    renderProfile();

    const backLink = await screen.findByRole("link", { name: /back to profile/i });
    expect(backLink).toHaveAttribute("href", "/profile");
  });

  it("shows an error with a retry that refetches the profile", async () => {
    mockedGetProfile.mockRejectedValue(new Error("boom"));
    renderProfile();

    expect(await screen.findByText("Unable to load your profile")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(mockedGetProfile).toHaveBeenCalledTimes(2);
    });
  });
});
