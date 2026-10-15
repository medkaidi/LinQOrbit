import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    listAllJobOffers: vi.fn(),
  };
});

const useContractTypesMock = vi.hoisted(() => vi.fn());
const useWorkModesMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-job-offers", () => ({
  useContractTypes: useContractTypesMock,
  useWorkModes: useWorkModesMock,
}));

import { listAllJobOffers } from "@/lib/api/admin.api";
import { AdminOffersSection } from "@/features/admin/admin-offers-section";
import type { AdminJobOfferListItem, AdminJobOfferPage } from "@/types/admin";

const mockedListAllJobOffers = vi.mocked(listAllJobOffers);

function makeOffer(overrides: Partial<AdminJobOfferListItem> = {}): AdminJobOfferListItem {
  return {
    id: "offer-1",
    title: "Backend Engineer",
    status: "published",
    companyName: "Acme",
    publicId: "pub-1",
    slug: "backend-engineer",
    createdAt: "2026-10-01T10:00:00",
    updatedAt: "2026-10-05T10:00:00",
    expiresAt: null,
    publishedAt: "2026-10-02T10:00:00",
    seniority: null,
    city: null,
    country: null,
    contractTypeId: null,
    workModeId: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    hasUnvalidatedChanges: false,
    normalizationJobStatus: "done",
    ...overrides,
  };
}

function makePage(items: AdminJobOfferListItem[], overrides: Partial<AdminJobOfferPage> = {}) {
  return { items, page: 0, size: 20, total: items.length, ...overrides };
}

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminOffersSection />
    </QueryClientProvider>,
  );
}

describe("AdminOffersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useContractTypesMock.mockReturnValue({
      data: [{ id: "ct1", label: "Permanent" }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useWorkModesMock.mockReturnValue({
      data: [{ id: "wm1", label: "Hybrid" }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("lists offers with the shared recruiter card (company pill, meta, status) and view action", async () => {
    mockedListAllJobOffers.mockResolvedValue(
      makePage([
        makeOffer({
          seniority: "senior",
          city: "Paris",
          country: "FR",
          contractTypeId: "ct1",
          workModeId: "wm1",
          salaryMin: 60000,
          salaryMax: 75000,
          salaryCurrency: "EUR",
          salaryPeriod: "year",
        }),
        makeOffer({
          id: "offer-2",
          title: "Frontend Engineer",
          status: "draft",
          companyName: null,
          publishedAt: null,
        }),
      ]),
    );

    renderSection();

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Backend Engineer" });
    expect(links[0]).toHaveAttribute("href", "/admin/offers/offer-1");
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
    // Pill company (seulement quand la company existe).
    expect(screen.getByText("Acme")).toBeInTheDocument();
    // Méta recruteur : séniorité, lieu+mode, contrat, salaire.
    expect(screen.getByText("Senior")).toBeInTheDocument();
    expect(screen.getByText("Hybrid · Paris, FR")).toBeInTheDocument();
    expect(screen.getByText("Permanent")).toBeInTheDocument();
    expect(screen.getByText("60,000 – 75,000 EUR per year")).toBeInTheDocument();
    // Deux pastilles de statut (hors boutons de filtre « Published »/« Draft »).
    expect(screen.getAllByText("Published").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(1);
    // Action lecture seule : un lien « View » par offre.
    const viewLinks = screen.getAllByRole("link", { name: "View" });
    expect(viewLinks).toHaveLength(2);
    expect(viewLinks[0]).toHaveAttribute("href", "/admin/offers/offer-1");
  });

  it("re-queries with the chosen status filter from the first page", async () => {
    mockedListAllJobOffers.mockResolvedValue(makePage([makeOffer()]));

    renderSection();

    await screen.findByText("Backend Engineer");
    mockedListAllJobOffers.mockClear();
    mockedListAllJobOffers.mockResolvedValue(makePage([]));

    fireEvent.click(screen.getByRole("button", { name: "Draft" }));

    await waitFor(() =>
      expect(mockedListAllJobOffers).toHaveBeenCalledWith(
        { status: "draft", page: 0 },
        { signal: expect.any(AbortSignal) },
      ),
    );
    expect(await screen.findByText(/No offers match this filter/)).toBeInTheDocument();
  });

  it("loads the next page through the load-more fallback", async () => {
    mockedListAllJobOffers.mockResolvedValue(makePage([makeOffer()], { total: 45 }));

    renderSection();

    await screen.findByText("Backend Engineer");
    expect(screen.getByText("45 offers")).toBeInTheDocument();

    mockedListAllJobOffers.mockClear();
    mockedListAllJobOffers.mockResolvedValue(
      makePage([makeOffer({ id: "offer-2", title: "Frontend Engineer" })], {
        page: 1,
        total: 45,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() =>
      expect(mockedListAllJobOffers).toHaveBeenCalledWith(
        { status: undefined, page: 1 },
        { signal: expect.any(AbortSignal) },
      ),
    );
    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    mockedListAllJobOffers.mockResolvedValue(makePage([]));

    renderSection();

    expect(await screen.findByText(/No offers match this filter/)).toBeInTheDocument();
  });

  it("surfaces a load error with a retry that re-queries", async () => {
    mockedListAllJobOffers.mockRejectedValueOnce(new Error("boom"));

    renderSection();

    expect(await screen.findByText("Unable to load offers")).toBeInTheDocument();

    mockedListAllJobOffers.mockResolvedValue(makePage([makeOffer()]));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
  });
});
