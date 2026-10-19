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

vi.mock("@/lib/api/auth.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth.api")>();
  return { ...actual, me: vi.fn() };
});

import {
  getProfile,
  getReferenceDegrees,
  getReferenceLanguages,
  getReferenceSkills,
  getReferenceStudyFields,
  parseCv,
} from "@/lib/api/candidate.api";
import { me } from "@/lib/api/auth.api";
import type { CandidateProfile, ParsedCv } from "@/types/candidate";
import type { AuthUser } from "@/types/auth";
import { ProfileEdit } from "@/features/candidate/profile-edit";

const mockedGetProfile = vi.mocked(getProfile);
const mockedParseCv = vi.mocked(parseCv);
const mockedMe = vi.mocked(me);
const mockedReferenceQueries = [
  vi.mocked(getReferenceSkills),
  vi.mocked(getReferenceLanguages),
  vi.mocked(getReferenceDegrees),
  vi.mocked(getReferenceStudyFields),
];

const profile: CandidateProfile = {
  about: {
    title: "Backend Engineer",
    targetPosition: "Staff Engineer",
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
  projects: [],
  diplomas: [],
  skills: [],
  languages: [],
  links: [],
  completionPercentage: 28,
  hasUnvalidatedChanges: false,
  normalizationFailed: false,
  normalizationInProgress: false,
  analysisOutdated: false,
};

const accountUser: AuthUser = {
  id: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  sex: "female",
  phone: "+1 555 000 0000",
  homeCountry: "GB",
  currentCity: "Paris",
  currentCountry: "FR",
  roles: [],
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
    mockedMe.mockReset();
    mockedMe.mockRejectedValue(new Error("no account in this test"));
    mockedReferenceQueries.forEach((query) => {
      query.mockReset();
      query.mockResolvedValue([]);
    });
  });

  it("renders every section with its completion state and the completion bar", async () => {
    renderProfile();

    expect(
      await screen.findByText("2 of 7 sections complete. A profile with substance gets more replies."),
    ).toBeInTheDocument();
    expect(screen.getByText("28%")).toBeInTheDocument();

    const progressbar = screen.getByRole("progressbar", { name: "Profile completeness" });
    expect(progressbar).toHaveAttribute("aria-valuenow", "28");

    for (const title of ["Personal Information", "Experience", "Projects", "Education", "Skills", "Languages", "Links & certifications"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }

    expect(screen.getAllByText("Complete")).toHaveLength(2);
    expect(screen.getAllByText("Not started")).toHaveLength(5);
  });

  it("offers the account identity inside About when the account is known", async () => {
    mockedMe.mockResolvedValue(accountUser);
    renderProfile();

    // Le formulaire fusionné remplace le formulaire About seul une fois le
    // compte connu : attendre son montage avant de typer la section.
    expect(await screen.findByLabelText("First name")).toHaveValue("Ada");
    const about = document.getElementById("about") as HTMLElement;
    expect(within(about).getByLabelText("Current position")).toHaveValue("Backend Engineer");
    expect(within(about).getByLabelText("Phone")).toHaveValue("+1 555 000 0000");
    expect(within(about).getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(within(about).queryByLabelText("Target position")).not.toBeInTheDocument();

    // La fusion n'ajoute pas de section : les badges restent ceux des 6 sections.
    expect(screen.getAllByText("Complete")).toHaveLength(2);
    expect(screen.getAllByText("Not started")).toHaveLength(5);
  });

  it("leaves the account fields empty when the account has no location data", async () => {
    // Compte créé sans profil (ex. AdminBootstrap) : null → champs vides, pas de crash.
    mockedMe.mockResolvedValue({
      ...accountUser,
      phone: null,
      currentCity: null,
      currentCountry: null,
    });
    renderProfile();

    expect(await screen.findByLabelText("First name")).toHaveValue("Ada");
    const about = document.getElementById("about") as HTMLElement;
    expect(within(about).getByLabelText("Phone")).toHaveValue("");
    expect(within(about).getByLabelText("Current city")).toHaveValue("");
    expect(within(about).getByLabelText("Current country")).toHaveValue("");
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

    expect(await screen.findByLabelText("Current position")).toHaveValue("Staff Engineer");

    const aboutSection = container.querySelector("#about") as HTMLElement;
    const saveButton = within(aboutSection).getByRole("button", { name: /save changes/i });
    expect(saveButton).toBeEnabled();
  });

  it("blocks the page behind a parsing dialog until the result arrives", async () => {
    mockedParseCv.mockReturnValue(new Promise(() => {}));
    const { container } = renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Upload CV" }));
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" })] },
    });

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("status")).toHaveTextContent("Parsing in progress…");

    // Échap sans effet pendant l'analyse.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("reports a failed CV analysis inside the dialog, which closes on demand", async () => {
    mockedParseCv.mockRejectedValue(
      Object.assign(new Error("request failed"), {
        isAxiosError: true,
        response: { data: { detail: "The AI service is unreachable." } },
      }),
    );
    const { container } = renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Upload CV" }));
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" })] },
    });

    const dialog = await screen.findByRole("dialog");
    const alert = within(dialog).getByRole("alert");
    expect(alert).toHaveTextContent("The AI service is unreachable.");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
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
