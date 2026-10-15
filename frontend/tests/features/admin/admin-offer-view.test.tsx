import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/admin/offers/offer-1",
}));

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
import { SHEET_HALF_PAD } from "@/features/admin/normalized/normalized-shared";
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
  contractType: "Permanent",
  employmentType: "Full-time",
  workMode: "Hybrid",
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

/** Offre source complète : skills (mandatory + preferred), langues, éducation. */
const fullJob: PublicJob = {
  ...publicJob,
  description: null,
  skills: [
    { skillId: "s1", name: "Java", requirementType: "mandatory", weight: 5, yearsExperience: 5 },
    { skillId: "s2", name: "Kotlin", requirementType: "preferred", weight: 3, yearsExperience: null },
  ],
  languages: [
    { languageId: "l1", symbol: "en", name: "English", level: "C1", isRequired: true },
    { languageId: "l2", symbol: "fr", name: "French", level: "B2", isRequired: false },
  ],
  degreeLabels: ["BSc Computer Science"],
  studyFieldLabels: ["Computer Science"],
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

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("shows the life-status badge and the source offer view even for a non-gated offer", async () => {
    mockedGetAdminJobOffer.mockResolvedValue({ ...offerDetail, status: "draft" });
    mockedGetOfferNormalizedProfile.mockResolvedValue(normalized);

    const { container } = renderOfferDetail();

    // Un seul h1 : la vue source ne répète pas le titre (contrairement à la fiche publique).
    expect(await screen.findByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Backend Engineer" })).toHaveLength(1);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("expires 2026-11-01")).toBeInTheDocument();
    // Offre stockée affichée sans gate published/expirée.
    expect(await screen.findByText("Build things that scale.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Description" })).toBeInTheDocument();
    // Drawer fermé : pile pleine largeur, pas de grille compacte ni de réduction.
    expect(container.querySelector('[class*="@2xl:grid-cols-2"]')).toBeNull();
    expect(container.firstElementChild).not.toHaveClass(SHEET_HALF_PAD);
    // CTA remonté juste sous le h1, avant la ligne company.
    const ctaHeading = screen.getByRole("heading", { name: "Normalized sheet" });
    const metaLine = screen.getByText(
      "Acme · Paris, FR · Senior · Permanent · Full-time · Hybrid · 70,000 – 90,000 EUR per year",
    );
    expect(
      metaLine.compareDocumentPosition(ctaHeading) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    // Header bits : labels résolus + salary.
    expect(
      screen.getByText(
        "Acme · Paris, FR · Senior · Permanent · Full-time · Hybrid · 70,000 – 90,000 EUR per year",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Job offers" })).toHaveAttribute(
      "href",
      "/admin/offers",
    );
  });

  it("renders stored skills, languages and education without normalized-only sections", async () => {
    mockedGetAdminJobOffer.mockResolvedValue({ ...offerDetail, detail: fullJob });
    mockedGetOfferNormalizedProfile.mockResolvedValue(normalized);

    renderOfferDetail();

    expect(await screen.findByRole("heading", { name: "Required skills" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Preferred skills" })).toBeInTheDocument();
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(screen.getByText("Weight 5/5")).toBeInTheDocument();
    expect(screen.getByText("5+ yrs")).toBeInTheDocument();
    expect(screen.getByText("Kotlin")).toBeInTheDocument();
    expect(screen.getByText("Weight 3/5")).toBeInTheDocument();
    expect(screen.getByText("English · C1")).toBeInTheDocument();
    expect(screen.getByText("French · B2 (nice-to-have)")).toBeInTheDocument();
    expect(screen.getByText("Degree: BSc Computer Science")).toBeInTheDocument();
    expect(screen.getByText("Field of study: Computer Science")).toBeInTheDocument();
    // Jamais de sections qui n'existent pas en base ni de description vide.
    expect(screen.queryByRole("heading", { name: "Description" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Responsibilities" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Benefits" })).not.toBeInTheDocument();
  });

  it("puts each source section in its own white card with candidate-view rounding", async () => {
    mockedGetAdminJobOffer.mockResolvedValue({ ...offerDetail, detail: fullJob });
    mockedGetOfferNormalizedProfile.mockResolvedValue(normalized);

    renderOfferDetail();

    // Chaque section (Skills, Languages, Education) vit dans sa propre
    // carte blanche arrondie (motif ViewSection de la vue candidat).
    const skillsHeading = await screen.findByRole("heading", { name: "Skills" });
    const skillsCard = skillsHeading.closest("section");
    expect(skillsCard).toHaveClass("bg-canvas-white", "rounded-2xl", "shadow-sm");
    const languagesCard = screen
      .getByRole("heading", { name: "Languages" })
      .closest("section");
    expect(languagesCard).toHaveClass("bg-canvas-white", "rounded-2xl");
    // Des cartes distinctes, jamais un conteneur unique.
    expect(languagesCard).not.toBe(skillsCard);
    // Les skills rows utilisent l'arrondi de la vue candidat (rounded-2xl p-4).
    const javaRow = screen.getByText("Java").closest("li");
    expect(javaRow).toHaveClass("rounded-2xl", "p-4");
  });

  it("opens the normalized sheet drawer from the CTA card", async () => {
    mockedGetAdminJobOffer.mockResolvedValue(offerDetail);
    mockedGetOfferNormalizedProfile.mockResolvedValue(normalized);

    renderOfferDetail();

    expect(
      await screen.findByRole("heading", { name: "Normalized sheet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("Schema")).toBeInTheDocument();
    expect(screen.getByText("1.0")).toBeInTheDocument();
    // Le rendu complet vit dans le drawer, pas inline.
    expect(screen.queryByText("Senior Backend Engineer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open sheet" }));

    expect(
      await screen.findByRole("dialog", { name: "Normalized sheet" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText(/Own the pipeline/)).toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/admin/offers/offer-1?sheet=open", {
      scroll: false,
    });
  });

  it("reopens the drawer from the ?sheet=open deep link", async () => {
    window.history.replaceState({}, "", "/admin/offers/offer-1?sheet=open");
    mockedGetAdminJobOffer.mockResolvedValue(offerDetail);
    mockedGetOfferNormalizedProfile.mockResolvedValue(normalized);

    const { container } = renderOfferDetail();

    const dialog = await screen.findByRole("dialog", { name: "Normalized sheet" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("v1")).toBeInTheDocument();
    // Drawer ouvert : la source se réduit (pr clamp) mais reste une
    // section par ligne — jamais de grille 2 colonnes.
    expect(container.querySelector('[class*="@2xl:grid-cols-2"]')).toBeNull();
    expect(container.firstElementChild).toHaveClass(SHEET_HALF_PAD);
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
