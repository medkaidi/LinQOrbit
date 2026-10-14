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
  });

  it("lists offers with title link, company, status badge and view action", async () => {
    mockedListAllJobOffers.mockResolvedValue(
      makePage([
        makeOffer(),
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
    expect(screen.getByText(/Acme · published 2026-10-02 · updated 2026-10-05/)).toBeInTheDocument();
    expect(screen.getByText(/No company · updated 2026-10-05/)).toBeInTheDocument();
    // Deux pastilles de statut (hors boutons de filtre « Published »/« Draft »).
    expect(screen.getAllByText("Published").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(1);
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
