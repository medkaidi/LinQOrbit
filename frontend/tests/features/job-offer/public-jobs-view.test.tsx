import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PublicJobsView } from "@/features/job-offer/public-jobs-view";
import type { PublicJobListItem } from "@/types/public-job";

const useInfinitePublicJobsMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-public-jobs", () => ({
  useInfinitePublicJobs: useInfinitePublicJobsMock,
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

describe("PublicJobsView", () => {
  beforeEach(() => {
    useInfinitePublicJobsMock.mockReset();
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
});
