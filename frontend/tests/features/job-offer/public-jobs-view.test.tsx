import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PublicJobsView } from "@/features/job-offer/public-jobs-view";
import { useHeaderSearchStore } from "@/stores/header-search-store";
import type { PublicJobListItem } from "@/types/public-job";

const useInfinitePublicJobsMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-public-jobs", () => ({
  useInfinitePublicJobs: useInfinitePublicJobsMock,
}));

// Vocabulaires de la toolbar : les ids sont ceux des filtres envoyés au backend.
vi.mock("@/hooks/use-job-offers", () => ({
  useWorkModes: () => ({
    data: [
      { id: "wm-remote", label: "Remote" },
      { id: "wm-onsite", label: "On-site" },
    ],
  }),
  useContractTypes: () => ({ data: [{ id: "ct-perm", label: "Permanent" }] }),
  useEmploymentTypes: () => ({ data: [{ id: "et-full", label: "Full-time" }] }),
}));

function job(overrides: Partial<PublicJobListItem> = {}): PublicJobListItem {
  return {
    publicId: "abcdefghijkl",
    slug: "backend-engineer",
    title: "Backend Engineer",
    companyName: "Acme Inc.",
    seniority: "senior",
    city: "Berlin",
    country: "DE",
    contractType: "Permanent",
    employmentType: "Full-time",
    workMode: "Remote",
    skills: ["Docker", "Kubernetes"],
    salaryMin: 60000,
    salaryMax: 80000,
    salaryCurrency: "EUR",
    salaryPeriod: "year",
    publishedAt: "2026-10-10T00:00:00Z",
    expiresAt: null,
    ...overrides,
  };
}

/** Forme retournée par useInfinitePublicJobs (une seule page chargée par défaut). */
function infiniteResult(
  jobs: PublicJobListItem[],
  overrides: Record<string, unknown> = {},
  total = jobs.length,
) {
  return {
    data: { pages: [{ items: jobs, page: 0, size: 20, total }], pageParams: [0] },
    isLoading: false,
    isError: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

/** AAAA-MM-JJ du jour local (jamais le jour UTC). */
function localIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Saisie dans le champ de recherche du header : la vue ne porte plus son propre champ. */
function typeInHeaderSearch(value: string) {
  act(() => useHeaderSearchStore.getState().setQuery(value));
}

describe("PublicJobsView", () => {
  beforeEach(() => {
    useInfinitePublicJobsMock.mockReset();
    useHeaderSearchStore.setState({ role: null, query: "" });
  });

  it("lists published offers with identity, meta, every skill and the actions", () => {
    useInfinitePublicJobsMock.mockReturnValue(infiniteResult([job()], {}, 42));

    render(<PublicJobsView />);

    expect(screen.getByRole("heading", { name: "Open positions" })).toBeInTheDocument();
    expect(screen.getByText("42 offers")).toBeInTheDocument();
    expect(screen.getByText("Acme Inc.")).toBeInTheDocument();
    const title = screen.getByRole("link", { name: "Backend Engineer" });
    expect(title).toHaveAttribute("href", "/jobs/abcdefghijkl-backend-engineer");
    expect(screen.getByText("Senior")).toBeInTheDocument();
    expect(screen.getByText("Berlin, DE")).toBeInTheDocument();
    expect(screen.getByText("Remote")).toBeInTheDocument();
    expect(screen.getByText("Permanent")).toBeInTheDocument();
    expect(screen.getByText("Full-time")).toBeInTheDocument();
    expect(screen.getByText("60,000 – 80,000 EUR per year")).toBeInTheDocument();

    // Toutes les compétences sont rendues (T-76, pas de plafond).
    expect(screen.getByText("Docker")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "View job" })).toHaveAttribute(
      "href",
      "/jobs/abcdefghijkl-backend-engineer",
    );
    expect(screen.getByRole("link", { name: "Apply" })).toHaveAttribute(
      "href",
      "/jobs/abcdefghijkl-backend-engineer/apply",
    );
  });

  it("tolerates missing optional fields (no company, no skills, everything else null)", () => {
    useInfinitePublicJobsMock.mockReturnValue(
      infiniteResult([
        job({
          companyName: null,
          seniority: null,
          city: null,
          country: null,
          contractType: null,
          employmentType: null,
          workMode: null,
          skills: [],
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: null,
          salaryPeriod: null,
          publishedAt: null,
        }),
      ]),
    );

    render(<PublicJobsView />);

    expect(screen.getByRole("link", { name: "Backend Engineer" })).toBeInTheDocument();
    expect(screen.getByText("No company")).toBeInTheDocument();
    expect(screen.queryByText(/EUR/)).not.toBeInTheDocument();
    expect(screen.queryByText("Docker")).not.toBeInTheDocument();
    // Les actions restent disponibles sans aucune méta.
    expect(screen.getByRole("link", { name: "View job" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Apply" })).toBeInTheDocument();
  });

  it("shows the expiry countdown when the offer is about to expire", () => {
    // Date locale (comme expiryCountdown) : toISOString() donnerait le jour UTC, faux entre minuit et 1 h (TD-051).
    const now = new Date();
    const inThreeDays = localIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3));
    useInfinitePublicJobsMock.mockReturnValue(
      infiniteResult([job({ expiresAt: inThreeDays })]),
    );

    render(<PublicJobsView />);

    expect(screen.getByText("Expires in 3 days")).toBeInTheDocument();
  });

  it("shows the loading state", () => {
    useInfinitePublicJobsMock.mockReturnValue(
      infiniteResult([], { data: undefined, isLoading: true }),
    );

    render(<PublicJobsView />);

    expect(screen.getByText("Loading jobs…")).toBeInTheDocument();
  });

  it("shows the empty state when no offer is published", () => {
    useInfinitePublicJobsMock.mockReturnValue(infiniteResult([], {}, 0));

    render(<PublicJobsView />);

    expect(screen.getByText("No open positions right now")).toBeInTheDocument();
  });

  it("surfaces a load error with a retry that refetches", () => {
    const refetch = vi.fn();
    useInfinitePublicJobsMock.mockReturnValue(
      infiniteResult([], { isError: true, error: new Error("boom"), refetch }),
    );

    render(<PublicJobsView />);

    expect(screen.getByText("Couldn't load offers")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps an accessible load-more fallback and the two-column grid classes", () => {
    const fetchNextPage = vi.fn();
    useInfinitePublicJobsMock.mockReturnValue(
      infiniteResult([job()], { hasNextPage: true, fetchNextPage }, 25),
    );

    render(<PublicJobsView />);

    expect(screen.getByRole("list")).toHaveClass("grid", "xl:grid-cols-2");

    // Le repli clavier est invisible tant qu'il n'a pas le focus (InfiniteList).
    const fallback = screen.getByRole("button", { name: "Load more" });
    expect(fallback).toHaveClass("sr-only");

    fireEvent.click(fallback);

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("hides Load more once every page is loaded", () => {
    useInfinitePublicJobsMock.mockReturnValue(infiniteResult([job()], {}, 1));

    render(<PublicJobsView />);

    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  describe("search, filters and sort (T-77)", () => {
    function lastFilters() {
      return useInfinitePublicJobsMock.mock.calls.at(-1)?.[0];
    }

    function pick(comboboxName: string, optionName: string) {
      fireEvent.click(screen.getByRole("combobox", { name: comboboxName }));
      fireEvent.click(screen.getByRole("option", { name: optionName }));
    }

    beforeEach(() => {
      useInfinitePublicJobsMock.mockReturnValue(infiniteResult([job()], {}, 1));
    });

    it("starts unfiltered: no filter key at all and no Reset", () => {
      render(<PublicJobsView />);

      expect(useInfinitePublicJobsMock).toHaveBeenCalledWith({});
      expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
    });

    it("owns the header search field while mounted, and gives it back on leaving", () => {
      const { unmount } = render(<PublicJobsView />);

      expect(useHeaderSearchStore.getState().role).toMatchObject({
        label: "Search jobs",
        placeholder: "Search by job title or company",
        maxLength: 100,
      });
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

      unmount();

      expect(useHeaderSearchStore.getState().role).toBeNull();
    });

    it("searches with a debounced, trimmed query", async () => {
      render(<PublicJobsView />);

      typeInHeaderSearch("  devops ");

      await waitFor(() => expect(lastFilters()).toEqual({ q: "devops" }));
    });

    it("treats a blank search as no filter", async () => {
      render(<PublicJobsView />);

      typeInHeaderSearch("devops");
      await waitFor(() => expect(lastFilters()).toEqual({ q: "devops" }));

      typeInHeaderSearch("   ");
      await waitFor(() => expect(lastFilters()).toEqual({}));
    });

    it("sends the chosen vocabulary, seniority and country filters, combined", () => {
      render(<PublicJobsView />);

      pick("Work mode", "Remote");
      pick("Contract", "Permanent");
      pick("Employment", "Full-time");
      pick("Seniority", "Senior");
      pick("Country", "France");

      expect(lastFilters()).toEqual({
        workModeId: "wm-remote",
        contractTypeId: "ct-perm",
        employmentTypeId: "et-full",
        seniority: "senior",
        country: "FR",
      });
    });

    it("picking All again removes the filter key", () => {
      render(<PublicJobsView />);
      pick("Work mode", "Remote");
      expect(lastFilters()).toEqual({ workModeId: "wm-remote" });

      pick("Work mode", "All");

      expect(lastFilters()).toEqual({});
    });

    it("sorts by expiring soon and sends nothing for the default order", () => {
      render(<PublicJobsView />);

      pick("Sort by", "Expiring soon");
      expect(lastFilters()).toEqual({ sort: "expiringSoon" });

      pick("Sort by", "Most recent");
      expect(lastFilters()).toEqual({});
    });

    it("resets search, filters and sort at once", async () => {
      render(<PublicJobsView />);
      typeInHeaderSearch("devops");
      pick("Work mode", "Remote");
      pick("Sort by", "Expiring soon");
      await waitFor(() =>
        expect(lastFilters()).toEqual({
          q: "devops",
          workModeId: "wm-remote",
          sort: "expiringSoon",
        }),
      );

      fireEvent.click(screen.getByRole("button", { name: "Reset" }));

      await waitFor(() => expect(lastFilters()).toEqual({}));
      // Reset vide aussi la saisie du header.
      expect(useHeaderSearchStore.getState().query).toBe("");
      expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
    });

    it("tells filtered-empty apart from empty, and offers a Reset", () => {
      useInfinitePublicJobsMock.mockReturnValue(infiniteResult([], {}, 0));
      render(<PublicJobsView />);
      expect(screen.getByText("No open positions right now")).toBeInTheDocument();

      pick("Work mode", "Remote");

      expect(screen.getByText("No offers match your filters")).toBeInTheDocument();
      expect(screen.queryByText("No open positions right now")).not.toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Reset" }).length).toBeGreaterThan(0);
    });

    it("a sort alone does not turn the empty state into a filtered one", () => {
      useInfinitePublicJobsMock.mockReturnValue(infiniteResult([], {}, 0));
      render(<PublicJobsView />);

      pick("Sort by", "Expiring soon");

      expect(screen.getByText("No open positions right now")).toBeInTheDocument();
    });

    it("a header search alone makes the empty state a filtered one, with a Reset", async () => {
      useInfinitePublicJobsMock.mockReturnValue(infiniteResult([], {}, 0));
      render(<PublicJobsView />);

      typeInHeaderSearch("zzz");

      expect(await screen.findByText("No offers match your filters")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Reset" }).length).toBeGreaterThan(0);
    });

    it("keeps the toolbar while loading and on error", () => {
      useInfinitePublicJobsMock.mockReturnValue(
        infiniteResult([], { data: undefined, isLoading: true }),
      );
      const { unmount } = render(<PublicJobsView />);
      expect(screen.getByRole("combobox", { name: "Work mode" })).toBeInTheDocument();
      unmount();

      useInfinitePublicJobsMock.mockReturnValue(
        infiniteResult([], { isError: true, error: new Error("boom") }),
      );
      render(<PublicJobsView />);
      expect(screen.getByText("Couldn't load offers")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Work mode" })).toBeInTheDocument();
      expect(useHeaderSearchStore.getState().role).not.toBeNull();
    });
  });
});
