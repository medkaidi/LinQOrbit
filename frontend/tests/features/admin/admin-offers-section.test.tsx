import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    listAllJobOffers: vi.fn(),
  };
});

const useContractTypesMock = vi.hoisted(() => vi.fn());
const useEmploymentTypesMock = vi.hoisted(() => vi.fn());
const useWorkModesMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-job-offers", () => ({
  useContractTypes: useContractTypesMock,
  useEmploymentTypes: useEmploymentTypesMock,
  useWorkModes: useWorkModesMock,
}));

vi.mock("@/components/navigation/user-menu", () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

import { AdminHeader } from "@/components/layout/admin-header";
import { listAllJobOffers } from "@/lib/api/admin.api";
import { AdminOffersSection } from "@/features/admin/admin-offers-section";
import { useHeaderSearchStore } from "@/stores/header-search-store";
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

/** Header et section montés ensemble : le champ du header pilote réellement la recherche. */
function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminHeader />
      <AdminOffersSection />
    </QueryClientProvider>,
  );
}

/** Dernier appel de liste : les filtres envoyés, page comprise. */
function lastParams() {
  return mockedListAllJobOffers.mock.calls.at(-1)?.[0];
}

/**
 * Répond selon les filtres reçus : la liste non filtrée et la liste filtrée se
 * distinguent à l'écran. Revenir à « All » relit le cache de la requête sans
 * filtre (30 s) — c'est le résultat affiché, pas le dernier appel, qui prouve
 * que le filtre est bien absent de la clé.
 */
function answerByFilters() {
  mockedListAllJobOffers.mockImplementation(async (params) => {
    const filtered = Object.keys(params ?? {}).some((key) => key !== "page");
    return makePage([makeOffer({ title: filtered ? "Filtered result" : "Unfiltered result" })]);
  });
}

function pick(control: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: control }));
  fireEvent.click(screen.getByRole("option", { name: option }));
}

function typeInHeader(value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Search offers" }), { target: { value } });
}

describe("AdminOffersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHeaderSearchStore.setState({ role: null, query: "" });
    useContractTypesMock.mockReturnValue({
      data: [{ id: "ct1", label: "Permanent" }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useEmploymentTypesMock.mockReturnValue({
      data: [{ id: "et1", label: "Full-time" }],
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
    // Pill company (seulement quand la company existe), libellé muted sinon.
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("No company")).toBeInTheDocument();
    // Méta recruteur : séniorité, lieu+mode, contrat, salaire.
    expect(screen.getByText("Senior")).toBeInTheDocument();
    expect(screen.getByText("Paris, FR")).toBeInTheDocument();
    expect(screen.getByText("Hybrid")).toBeInTheDocument();
    expect(screen.getByText("Permanent")).toBeInTheDocument();
    expect(screen.getByText("60,000 – 75,000 EUR per year")).toBeInTheDocument();
    // Une pastille de statut par offre : les filtres fermés n'affichent que « All ».
    expect(screen.getAllByText("Published")).toHaveLength(1);
    expect(screen.getAllByText("Draft")).toHaveLength(1);
    // Action lecture seule : un lien « View » par offre.
    const viewLinks = screen.getAllByRole("link", { name: "View" });
    expect(viewLinks).toHaveLength(2);
    expect(viewLinks[0]).toHaveAttribute("href", "/admin/offers/offer-1");
  });

  describe("search lives in the header", () => {
    it("declares the header search for the page, with its own label and cap, and gives it back on leave", async () => {
      mockedListAllJobOffers.mockResolvedValue(makePage([makeOffer()]));

      const { unmount } = renderSection();

      const field = screen.getByRole("textbox", { name: "Search offers" });
      expect(field).toHaveAttribute("placeholder", "Search by title or company");
      expect(field).toHaveAttribute("maxlength", "100");
      // Plus de champ de recherche dans la page elle-même.
      expect(screen.getAllByRole("textbox")).toHaveLength(1);
      await screen.findByText("Backend Engineer");

      unmount();
      expect(useHeaderSearchStore.getState().role).toBeNull();
    });

    it("sends no filter at all on the first request (absent)", async () => {
      mockedListAllJobOffers.mockResolvedValue(makePage([makeOffer()]));

      renderSection();

      await screen.findByText("Backend Engineer");
      expect(mockedListAllJobOffers).toHaveBeenCalledTimes(1);
      expect(mockedListAllJobOffers).toHaveBeenCalledWith({ page: 0 }, expect.anything());
    });

    it("sends the typed search after the debounce, trimmed, and drops it when cleared (empty)", async () => {
      answerByFilters();
      renderSection();
      await screen.findByText("Unfiltered result");

      typeInHeader("  acme  ");
      // Pas de requête à chaque frappe : le debounce regroupe la saisie.
      expect(lastParams()).toEqual({ page: 0 });
      await waitFor(() => expect(lastParams()).toEqual({ q: "acme", page: 0 }), { timeout: 2000 });
      expect(await screen.findByText("Filtered result")).toBeInTheDocument();

      typeInHeader("");
      expect(await screen.findByText("Unfiltered result", {}, { timeout: 2000 })).toBeInTheDocument();
      expect(screen.queryByText("Filtered result")).not.toBeInTheDocument();
    });

    it("treats a blank search as no search", async () => {
      mockedListAllJobOffers.mockResolvedValue(makePage([makeOffer()]));
      renderSection();
      await screen.findByText("Backend Engineer");
      const before = mockedListAllJobOffers.mock.calls.length;

      typeInHeader("    ");
      await new Promise((resolve) => setTimeout(resolve, 450));

      expect(lastParams()).toEqual({ page: 0 });
      expect(mockedListAllJobOffers.mock.calls.length).toBe(before);
    });
  });

  describe("filters", () => {
    it("offers the six filters in a row, status as a select rather than a segmented control", async () => {
      mockedListAllJobOffers.mockResolvedValue(makePage([makeOffer()]));

      renderSection();

      await screen.findByText("Backend Engineer");
      for (const name of ["Status", "Work mode", "Contract", "Employment", "Seniority", "Deadline"]) {
        expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
      }
      expect(screen.queryByRole("group", { name: /filter offers by status/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
    });

    it.each([
      ["Status", "Draft", { status: "draft" }],
      ["Work mode", "Hybrid", { workModeId: "wm1" }],
      ["Contract", "Permanent", { contractTypeId: "ct1" }],
      ["Employment", "Full-time", { employmentTypeId: "et1" }],
      ["Seniority", "Senior", { seniority: "senior" }],
      ["Deadline", "Expiring soon", { expiry: "expiringSoon" }],
      ["Deadline", "Expired", { expiry: "expired" }],
    ])("sends the %s filter (%s) from the first page, and omits it again on All", async (control, option, expected) => {
      answerByFilters();
      renderSection();
      await screen.findByText("Unfiltered result");

      pick(control, option);

      await waitFor(() => expect(lastParams()).toEqual({ ...expected, page: 0 }));
      expect(await screen.findByText("Filtered result")).toBeInTheDocument();

      pick(control, "All");

      expect(await screen.findByText("Unfiltered result")).toBeInTheDocument();
      expect(screen.queryByText("Filtered result")).not.toBeInTheDocument();
    });

    it("combines the search and every filter in one request", async () => {
      mockedListAllJobOffers.mockResolvedValue(makePage([makeOffer()]));
      renderSection();
      await screen.findByText("Backend Engineer");

      pick("Status", "Published");
      pick("Work mode", "Hybrid");
      pick("Seniority", "Senior");
      typeInHeader("globex");

      await waitFor(
        () =>
          expect(lastParams()).toEqual({
            q: "globex",
            status: "published",
            workModeId: "wm1",
            seniority: "senior",
            page: 0,
          }),
        { timeout: 2000 },
      );
    });

    it("never sends a company filter nor a size", async () => {
      mockedListAllJobOffers.mockResolvedValue(makePage([makeOffer()]));
      renderSection();
      await screen.findByText("Backend Engineer");

      pick("Status", "Closed");

      await waitFor(() => expect(lastParams()).toEqual({ status: "closed", page: 0 }));
      expect(lastParams()).not.toHaveProperty("companyId");
      expect(lastParams()).not.toHaveProperty("size");
    });

    it("resets the filters and the header search at once, and the button disappears with them", async () => {
      answerByFilters();
      renderSection();
      await screen.findByText("Unfiltered result");

      pick("Status", "Draft");
      typeInHeader("acme");
      fireEvent.click(await screen.findByRole("button", { name: "Reset" }));

      expect(screen.getByRole("textbox", { name: "Search offers" })).toHaveValue("");
      expect(screen.getByRole("combobox", { name: "Status" })).toHaveTextContent("All");
      expect(await screen.findByText("Unfiltered result")).toBeInTheDocument();
      expect(screen.queryByText("Filtered result")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
    });

    it("shows Reset as soon as the search alone is active", async () => {
      mockedListAllJobOffers.mockResolvedValue(makePage([makeOffer()]));
      renderSection();
      await screen.findByText("Backend Engineer");

      typeInHeader("acme");

      expect(await screen.findByRole("button", { name: "Reset" })).toBeInTheDocument();
    });

    it("says no offer matches the filters, with a Reset, and the header count follows the filtered total", async () => {
      mockedListAllJobOffers.mockResolvedValue(makePage([makeOffer()]));
      renderSection();
      await screen.findByText("Backend Engineer");
      mockedListAllJobOffers.mockResolvedValue(makePage([], { total: 0 }));

      pick("Status", "Draft");

      expect(await screen.findByText("No offers match your filters.")).toBeInTheDocument();
      expect(screen.getByText("0 offers")).toBeInTheDocument();
      const empty = screen.getByText("No offers match your filters.").parentElement as HTMLElement;
      fireEvent.click(within(empty).getByRole("button", { name: "Reset" }));
      mockedListAllJobOffers.mockResolvedValue(makePage([makeOffer()]));
      expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
    });

    it("keeps the toolbar while the first page loads and when the load fails", async () => {
      mockedListAllJobOffers.mockReturnValue(new Promise(() => {}));
      const { unmount } = renderSection();

      expect(await screen.findByText("Loading offers…")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
      unmount();

      mockedListAllJobOffers.mockRejectedValue(new Error("boom"));
      renderSection();

      expect(await screen.findByText("Unable to load offers")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
    });
  });

  it("loads the next page through the load-more fallback, keeping the active filters", async () => {
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
        { page: 1 },
        { signal: expect.any(AbortSignal) },
      ),
    );
    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();

    mockedListAllJobOffers.mockClear();
    mockedListAllJobOffers.mockResolvedValue(makePage([makeOffer()], { total: 45 }));
    pick("Status", "Published");
    await waitFor(() => expect(lastParams()).toEqual({ status: "published", page: 0 }));
  });

  it("shows the header with the global count and an unfiltered empty state", async () => {
    mockedListAllJobOffers.mockResolvedValue(makePage([], { total: 0 }));

    renderSection();

    expect(await screen.findByText("No offers yet.")).toBeInTheDocument();
    expect(screen.getByText("0 offers")).toBeInTheDocument();
    // Pas de Reset quand rien n'est filtré.
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Job offers" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Administration" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("shows a loading state with a spinner while the first page loads", async () => {
    mockedListAllJobOffers.mockReturnValue(new Promise(() => {}));

    renderSection();

    expect(await screen.findByText("Loading offers…")).toBeInTheDocument();
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
