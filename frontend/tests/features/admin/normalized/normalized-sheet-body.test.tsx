import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    getUserDetail: vi.fn(),
    getUserNormalizedProfile: vi.fn(),
    getUserNormalizedProfileVersions: vi.fn(),
    getAdminJobOffer: vi.fn(),
    getOfferNormalizedProfile: vi.fn(),
    getOfferNormalizedProfileVersions: vi.fn(),
  };
});

import {
  getAdminJobOffer,
  getOfferNormalizedProfile,
  getOfferNormalizedProfileVersions,
  getUserDetail,
  getUserNormalizedProfile,
  getUserNormalizedProfileVersions,
} from "@/lib/api/admin.api";
import { NormalizedSheetBody } from "@/features/admin/normalized/normalized-sheet-body";
import type {
  AdminJobOfferDetail,
  AdminNormalizedProfile,
  AdminUserDetail,
} from "@/types/admin";
import type { NormalizedCandidateProfile, NormalizedJobOffer } from "@/types/normalized";
import type { PublicJob } from "@/types/public-job";

const mockedGetUserDetail = vi.mocked(getUserDetail);
const mockedGetUserNormalizedProfile = vi.mocked(getUserNormalizedProfile);
const mockedGetUserVersions = vi.mocked(getUserNormalizedProfileVersions);
const mockedGetAdminJobOffer = vi.mocked(getAdminJobOffer);
const mockedGetOfferNormalizedProfile = vi.mocked(getOfferNormalizedProfile);
const mockedGetOfferVersions = vi.mocked(getOfferNormalizedProfileVersions);

const account: AdminUserDetail = {
  id: "user-2",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  status: "ACTIVE",
  roles: [],
  phone: null,
  sex: "female",
  homeCountry: "FR",
  currentCity: "Paris",
  currentCountry: "FR",
  createdAt: "2026-09-01T10:00:00",
  hasCandidateProfile: true,
  hasRecruiterProfile: false,
};

const currentProfile: AdminNormalizedProfile<NormalizedCandidateProfile> = {
  profileId: "np-3",
  version: 3,
  schemaVersion: "2.0",
  validatedAt: "2026-10-12T12:00:00",
  jobStatus: "done",
  content: { title: "Senior Mathematician" },
};

const olderProfile: AdminNormalizedProfile<NormalizedCandidateProfile> = {
  profileId: "np-2",
  version: 2,
  schemaVersion: "2.0",
  validatedAt: "2026-10-08T12:00:00",
  jobStatus: "done",
  content: { title: "Mathematician" },
};

const offerNormalized: AdminNormalizedProfile<NormalizedJobOffer> = {
  profileId: "np-o1",
  version: 1,
  schemaVersion: "1.0",
  validatedAt: "2026-10-10T12:00:00",
  jobStatus: "done",
  content: { title: "Senior Backend Engineer" },
};

const publicJob: PublicJob = {
  publicId: "pub-1",
  slug: "backend-engineer",
  title: "Backend Engineer",
  description: "<p>Build things that scale.</p>",
  seniority: "senior",
  requiredExpYear: 5,
  city: "Paris",
  country: "FR",
  companyName: "Acme",
  contractType: "permanent",
  employmentType: "full_time",
  workMode: "hybrid",
  salaryMin: 70000,
  salaryMax: 90000,
  salaryCurrency: "EUR",
  salaryPeriod: "year",
  expiresAt: "2026-11-01",
  skills: [
    { skillId: "s1", name: "Java", requirementType: "mandatory", weight: 5, yearsExperience: 5 },
  ],
  languages: [],
  degreeLabels: [],
  studyFieldLabels: [],
  publishedAt: "2026-10-02T10:00:00",
};

const offerDetail: AdminJobOfferDetail = {
  id: "offer-1",
  status: "published",
  createdAt: "2026-10-01T10:00:00",
  updatedAt: "2026-10-05T10:00:00",
  detail: publicJob,
};

function axiosErrorWithStatus(status: number): Error {
  const error = new Error(`Request failed with status code ${status}`);
  Object.assign(error, { isAxiosError: true, response: { status } });
  return error;
}

function renderBody(kind: "user" | "offer", id = kind === "user" ? "user-2" : "offer-1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NormalizedSheetBody kind={kind} id={id} />
    </QueryClientProvider>,
  );
}

describe("NormalizedSheetBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the account sheet with its History action and JSON actions", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetUserNormalizedProfile.mockResolvedValue(currentProfile);

    renderBody("user");

    expect(await screen.findByText("Senior Mathematician")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download JSON" })).toBeInTheDocument();
  });

  it("stays lazy until History opens, then switches the displayed version", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetUserNormalizedProfile.mockResolvedValue(currentProfile);
    mockedGetUserVersions.mockResolvedValue([currentProfile, olderProfile]);

    renderBody("user");
    await screen.findByText("Senior Mathematician");
    expect(mockedGetUserVersions).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "History" }));

    expect(await screen.findByRole("heading", { name: "Version history" })).toBeInTheDocument();
    expect(mockedGetUserVersions).toHaveBeenCalledWith("user-2");
    const currentRow = await screen.findByRole("button", { name: /^v3/ });
    const olderRow = screen.getByRole("button", { name: /^v2/ });
    expect(currentRow).toHaveAttribute("aria-pressed", "true");
    expect(olderRow).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(olderRow);

    expect(await screen.findByText(/Viewing v2 — current is v3/)).toBeInTheDocument();
    expect(await screen.findByText("Mathematician")).toBeInTheDocument();
    expect(screen.queryByText("Senior Mathematician")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to current" }));

    expect(await screen.findByText("Senior Mathematician")).toBeInTheDocument();
    expect(screen.queryByText(/Viewing v2/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to current" })).not.toBeInTheDocument();
  });

  it("explains a never-validated account without a History action", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetUserNormalizedProfile.mockRejectedValue(axiosErrorWithStatus(404));

    renderBody("user");

    expect(
      await screen.findByText(/No normalized profile has been produced yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "History" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("mentions an account without candidate profile", async () => {
    mockedGetUserDetail.mockResolvedValue({ ...account, hasCandidateProfile: false });
    mockedGetUserNormalizedProfile.mockResolvedValue(currentProfile);

    renderBody("user");

    expect(await screen.findByText(/has no candidate profile/)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Normalized profile" }),
    ).not.toBeInTheDocument();
  });

  it("surfaces a detail load error with a retry", async () => {
    mockedGetUserDetail.mockRejectedValue(new Error("boom"));

    renderBody("user");

    expect(await screen.findByText("Unable to load the element")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("renders the offer sheet content", async () => {
    mockedGetAdminJobOffer.mockResolvedValue(offerDetail);
    mockedGetOfferNormalizedProfile.mockResolvedValue(offerNormalized);

    renderBody("offer");

    expect(await screen.findByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
  });

  it("opens the offer version history lazily", async () => {
    mockedGetAdminJobOffer.mockResolvedValue(offerDetail);
    mockedGetOfferNormalizedProfile.mockResolvedValue(offerNormalized);
    mockedGetOfferVersions.mockResolvedValue([offerNormalized]);

    renderBody("offer");
    await screen.findByText("Senior Backend Engineer");
    expect(mockedGetOfferVersions).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "History" }));

    expect(await screen.findByRole("heading", { name: "Version history" })).toBeInTheDocument();
    expect(mockedGetOfferVersions).toHaveBeenCalledWith("offer-1");
    expect(await screen.findByRole("button", { name: /^v1/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
