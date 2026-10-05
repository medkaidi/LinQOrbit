import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  type CandidateProfile,
} from "@/lib/api/candidate.api";
import { me, type AuthUser } from "@/lib/api/auth.api";
import { ProfileView } from "@/features/candidate/profile-view";

const mockedGetProfile = vi.mocked(getProfile);
const mockedMe = vi.mocked(me);
const mockedReferenceQueries = [
  vi.mocked(getReferenceSkills),
  vi.mocked(getReferenceLanguages),
  vi.mocked(getReferenceDegrees),
  vi.mocked(getReferenceStudyFields),
];

const filledProfile: CandidateProfile = {
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
      description: "Owned the public API.",
      startDate: "2023-04-01",
      endDate: null,
      companyName: "Acme",
      companyCountry: "FR",
    },
    {
      id: "e2",
      positionTitle: "Junior Developer",
      description: null,
      startDate: "2020-09-01",
      endDate: "2023-03-01",
      companyName: "Globex",
      companyCountry: "DE",
    },
  ],
  diplomas: [],
  skills: [
    {
      skillId: "s1",
      name: "Java",
      skillType: "tech",
      level: 4,
      yearsExperience: 7,
    },
  ],
  languages: [{ languageId: "l1", symbol: "fr", name: "French", level: "C2" }],
  links: [
    {
      id: "k1",
      label: "GitHub",
      url: "https://github.com/camille",
      linkType: "github",
      issuer: null,
      issuedAt: null,
    },
  ],
  completionPercentage: 83,
};

const emptyProfile: CandidateProfile = {
  about: { title: null, bio: null, yearsOfExperience: null, searchStatus: null },
  experiences: [],
  diplomas: [],
  skills: [],
  languages: [],
  links: [],
  completionPercentage: 0,
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
};

function renderProfile() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileView />
    </QueryClientProvider>,
  );
}

describe("ProfileView", () => {
  beforeEach(() => {
    mockedGetProfile.mockReset();
    mockedGetProfile.mockResolvedValue(filledProfile);
    mockedMe.mockReset();
    mockedMe.mockRejectedValue(new Error("no account in this test"));
    mockedReferenceQueries.forEach((query) => {
      query.mockReset();
      query.mockResolvedValue([]);
    });
  });

  it("shows the breadcrumb, the title and the completion state", async () => {
    renderProfile();

    expect(
      await screen.findByRole("heading", { name: "My professional profile" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Candidate space" })).toHaveAttribute("href", "/dashboard");
    expect(
      await screen.findByText("5 of 6 sections complete. A profile with substance gets more replies."),
    ).toBeInTheDocument();
    expect(screen.getByText("83%")).toBeInTheDocument();
  });

  it("renders every section as a read-only card", async () => {
    renderProfile();

    expect(await screen.findByRole("heading", { name: "About" })).toBeInTheDocument();

    expect(screen.getByText("2 entries")).toBeInTheDocument();

    for (const title of ["Experience", "Education", "Skills", "Languages", "Links & certifications"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }

    expect(screen.getAllByText("Backend Engineer")).toHaveLength(2);
    expect(screen.getByText("Acme · France")).toBeInTheDocument();
    // Durée affichée uniquement sur les expériences : la période « Present » dépend de la date du jour.
    expect(screen.getByText(/Apr 2023 — Present \(\d+ yrs?( \d+ mos?)?\)/)).toBeInTheDocument();
    expect(screen.getByText("Sep 2020 — Mar 2023 (2 yrs 6 mos)")).toBeInTheDocument();
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(screen.getByText("French")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/camille",
    );
  });

  it("shows the identity card above the sections", async () => {
    mockedMe.mockResolvedValue(accountUser);
    renderProfile();

    expect(await screen.findByRole("heading", { name: "Identity" })).toBeInTheDocument();

    const identity = document.getElementById("identity") as HTMLElement;
    expect(within(identity).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(identity).getByText("Backend Engineer")).toBeInTheDocument();
    expect(within(identity).getByText("ada@example.com")).toBeInTheDocument();
    expect(within(identity).getByText("France")).toBeInTheDocument();
  });

  it("offers an edit action that points at the editor", async () => {
    renderProfile();

    const editLink = await screen.findByRole("link", { name: /edit profile/i });
    expect(editLink).toHaveAttribute("href", "/profile/edit");
  });

  it("does not fetch reference data in display mode", async () => {
    renderProfile();
    await screen.findByRole("heading", { name: "About" });

    await waitFor(() => expect(mockedGetProfile).toHaveBeenCalled());
    mockedReferenceQueries.forEach((query) => expect(query).not.toHaveBeenCalled());
  });

  it("shows empty states with a call to action per section", async () => {
    mockedGetProfile.mockResolvedValue(emptyProfile);
    renderProfile();

    await screen.findByText("Your headline and summary are not written yet.");

    const ctas = screen.getAllByRole("link");
    const editCtas = ctas.filter(
      (link) => link.getAttribute("href") === "/profile/edit" && link.textContent !== "",
    );
    expect(editCtas.length).toBeGreaterThanOrEqual(6);
    expect(screen.getByRole("link", { name: "Add experience" })).toHaveAttribute(
      "href",
      "/profile/edit",
    );
    expect(screen.getByRole("link", { name: "Add skills" })).toHaveAttribute("href", "/profile/edit");
  });

  it("shows a skeleton while the profile is loading", () => {
    mockedGetProfile.mockReturnValue(new Promise<CandidateProfile>(() => {}));
    renderProfile();

    expect(screen.getByRole("status", { name: /loading profile/i })).toBeInTheDocument();
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
