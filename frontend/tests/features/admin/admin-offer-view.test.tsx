import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    getAdminJobOffer: vi.fn(),
    getOfferNormalizedProfile: vi.fn(),
  };
});

import { getAdminJobOffer, getOfferNormalizedProfile } from "@/lib/api/admin.api";
import { AdminOfferDetailView } from "@/features/admin/admin-offer-view";
import type { AdminJobOfferDetail, AdminNormalizedProfile } from "@/types/admin";
import type { NormalizedJobOffer } from "@/types/normalized";
import type { PublicJob } from "@/types/public-job";

const mockedGetAdminJobOffer = vi.mocked(getAdminJobOffer);
const mockedGetOfferNormalizedProfile = vi.mocked(getOfferNormalizedProfile);

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

const normalized: AdminNormalizedProfile<NormalizedJobOffer> = {
  profileId: "np-1",
  version: 1,
  schemaVersion: "1.0",
  validatedAt: "2026-10-10T12:00:00",
  jobStatus: "done",
  content: { title: "Senior Backend Engineer", summary: "Own the pipeline." },
};

function axiosErrorWithStatus(status: number): Error {
  const error = new Error(`Request failed with status code ${status}`);
  Object.assign(error, { isAxiosError: true, response: { status } });
  return error;
}

function renderOfferDetail(offerId = "offer-1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminOfferDetailView offerId={offerId} />
    </QueryClientProvider>,
  );
}

describe("AdminOfferDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the life-status badge and the public article even for a non-gated offer", async () => {
    mockedGetAdminJobOffer.mockResolvedValue({ ...offerDetail, status: "draft" });
    mockedGetOfferNormalizedProfile.mockResolvedValue(normalized);

    renderOfferDetail();

    // Le h1 de l'en-tête admin + celui de la fiche publique rendue.
    const headings = await screen.findAllByRole("heading", { name: "Backend Engineer" });
    expect(headings.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("expires 2026-11-01")).toBeInTheDocument();
    // La fiche publique rendue sans gate published/expirée.
    expect(await screen.findByText("Build things that scale.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Job offers" })).toHaveAttribute(
      "href",
      "/admin/offers",
    );
  });

  it("renders the normalized offer sheet with its envelope", async () => {
    mockedGetAdminJobOffer.mockResolvedValue(offerDetail);
    mockedGetOfferNormalizedProfile.mockResolvedValue(normalized);

    renderOfferDetail();

    expect(await screen.findByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText(/Own the pipeline\./)).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("schema 1.0")).toBeInTheDocument();
  });

  it("explains a never-validated normalized offer without a retry", async () => {
    mockedGetAdminJobOffer.mockResolvedValue(offerDetail);
    mockedGetOfferNormalizedProfile.mockRejectedValue(axiosErrorWithStatus(404));

    renderOfferDetail();

    expect(
      await screen.findByText(/No normalized profile has been produced yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("surfaces a load error when the offer cannot be fetched", async () => {
    mockedGetAdminJobOffer.mockRejectedValue(new Error("boom"));

    renderOfferDetail();

    expect(await screen.findByText("Unable to load the offer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
