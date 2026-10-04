import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return {
    ...actual,
    getProfile: vi.fn(),
    parseCv: vi.fn(),
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
  parseCv,
  type CandidateProfile,
  type ParsedCv,
} from "@/lib/api/candidate.api";
import { ProfileEdit } from "@/features/candidate/profile-edit";

const mockedGetProfile = vi.mocked(getProfile);
const mockedParseCv = vi.mocked(parseCv);
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

  it("offers the CV upload while the photo action stays unavailable", async () => {
    renderProfile();

    const uploadButton = await screen.findByRole("button", { name: "Upload CV" });
    expect(uploadButton).toBeEnabled();
    expect(uploadButton).not.toHaveAttribute("aria-disabled");

    const photoButton = screen.getByRole("button", { name: "Add photo" });
    expect(photoButton).toBeDisabled();
    expect(photoButton).toHaveAttribute("aria-disabled", "true");
    expect(photoButton).toHaveAttribute("title", "Coming soon");
  });

  it("previews an uploaded CV, then applies it to the sections", async () => {
    const parsedCv: ParsedCv = {
      title: "Staff Engineer",
      summary: "I design platforms.",
      experiences: [
        {
          positionTitle: "Staff Engineer",
          companyName: "Globex",
          companyCountry: "France",
          startDate: "2022-05",
          endDate: null,
          description: null,
        },
      ],
      diplomas: [],
      skills: [],
      languages: [],
      links: [],
    };
    mockedParseCv.mockResolvedValue(parsedCv);
    const { container } = renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Upload CV" }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" })] },
    });

    expect(await screen.findByText("Review your CV import")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply to my profile" }));

    expect(await screen.findByLabelText("Professional title")).toHaveValue("Staff Engineer");

    const aboutSection = container.querySelector("#about") as HTMLElement;
    const saveButton = within(aboutSection).getByRole("button", { name: /save changes/i });
    expect(saveButton).toBeEnabled();
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
