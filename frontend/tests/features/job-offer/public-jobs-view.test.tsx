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

describe("PublicJobsView", () => {
  beforeEach(() => {
    useInfinitePublicJobsMock.mockReset();
  });

  it("lists published offers with identity, chips and the public link", () => {
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
  });

  it("tolerates missing optional fields (no company, everything else null)", () => {
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

  it("loads the next page on demand", () => {
    const fetchNextPage = vi.fn();
    useInfinitePublicJobsMock.mockReturnValue(
      infiniteResult([job()], { hasNextPage: true, fetchNextPage }, 25),
    );

    render(<PublicJobsView />);

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("hides Load more once every page is loaded", () => {
    useInfinitePublicJobsMock.mockReturnValue(infiniteResult([job()], {}, 1));

    render(<PublicJobsView />);

    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });
});
