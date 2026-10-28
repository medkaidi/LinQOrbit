import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PublicJobsDirectory } from "@/features/marketing/public-jobs-directory";
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

function lastFilters() {
  return useInfinitePublicJobsMock.mock.calls.at(-1)?.[0];
}

function pick(comboboxName: string, optionName: string) {
  fireEvent.click(screen.getByRole("combobox", { name: comboboxName }));
  fireEvent.click(screen.getByRole("option", { name: optionName }));
}

function searchField() {
  return screen.getByRole("textbox", { name: "Search by job title or company" });
}

describe("PublicJobsDirectory (vitrine publique /public/jobs)", () => {
  beforeEach(() => {
    useInfinitePublicJobsMock.mockReset();
    useInfinitePublicJobsMock.mockReturnValue(infiniteResult([job()], {}, 42));
  });

  it("expose la vitrine et ses CTA sans compte", () => {
    render(<PublicJobsDirectory initialQuery="" />);

    expect(
      screen.getByRole("heading", { name: /Job offers published on LinQOrbit/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create your account/ })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("liste les offres et ouvre la fiche publique, la candidature restant authentifiée", () => {
    render(<PublicJobsDirectory initialQuery="" />);

    expect(screen.getByText("42 offers")).toBeInTheDocument();
    expect(screen.getByText("Acme Inc.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Backend Engineer" })).toHaveAttribute(
      "href",
      "/public/jobs/abcdefghijkl-backend-engineer",
    );
    expect(screen.getByRole("link", { name: "View job" })).toHaveAttribute(
      "href",
      "/public/jobs/abcdefghijkl-backend-engineer",
    );
    // La candidature reste derrière l'AuthGate : le lien mène à la route
    // authentifiée, qui redirige vers le login avec retour.
    expect(screen.getByRole("link", { name: "Apply" })).toHaveAttribute(
      "href",
      "/jobs/abcdefghijkl-backend-engineer/apply",
    );
  });

  it("ne prend pas le champ de recherche du header : la page a le sien", () => {
    render(<PublicJobsDirectory initialQuery="" />);

    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(searchField()).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("reprend la recherche initiale venue de l'accueil", () => {
    render(<PublicJobsDirectory initialQuery="devops" />);

    expect(searchField()).toHaveValue("devops");
    expect(lastFilters()).toEqual({ q: "devops" });
  });

  it("filtre avec une recherche débouncée et nettoyée", async () => {
    render(<PublicJobsDirectory initialQuery="" />);

    fireEvent.change(searchField(), { target: { value: "  devops " } });

    await waitFor(() => expect(lastFilters()).toEqual({ q: "devops" }));

    fireEvent.change(searchField(), { target: { value: "   " } });

    await waitFor(() => expect(lastFilters()).toEqual({}));
  });

  it("propose les mêmes filtres que le board authentifié", () => {
    render(<PublicJobsDirectory initialQuery="" />);

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

  it("trie par échéance la plus proche", () => {
    render(<PublicJobsDirectory initialQuery="" />);

    pick("Sort by", "Expiring soon");

    expect(lastFilters()).toEqual({ sort: "expiringSoon" });
  });

  it("ne démarre sur aucun filtre", () => {
    render(<PublicJobsDirectory initialQuery="" />);

    expect(useInfinitePublicJobsMock).toHaveBeenCalledWith({});
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  });

  it("remet la recherche, les filtres et le tri à zéro", async () => {
    render(<PublicJobsDirectory initialQuery="devops" />);

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
    expect(searchField()).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  });

  it("distingue le vide filtré du vide sans offre", () => {
    useInfinitePublicJobsMock.mockReturnValue(infiniteResult([], {}, 0));
    render(<PublicJobsDirectory initialQuery="" />);

    expect(screen.getByText("No open positions right now")).toBeInTheDocument();

    pick("Work mode", "Remote");

    expect(screen.getByText("No offers match your filters")).toBeInTheDocument();
    expect(screen.queryByText("No open positions right now")).not.toBeInTheDocument();
  });

  it("affiche l'état de chargement", () => {
    useInfinitePublicJobsMock.mockReturnValue(
      infiniteResult([], { data: undefined, isLoading: true }),
    );
    render(<PublicJobsDirectory initialQuery="" />);

    expect(screen.getByText("Loading jobs…")).toBeInTheDocument();
  });

  it("affiche l'erreur de chargement avec un Retry", () => {
    const refetch = vi.fn();
    useInfinitePublicJobsMock.mockReturnValue(
      infiniteResult([], { isError: true, error: new Error("boom"), refetch }),
    );
    render(<PublicJobsDirectory initialQuery="" />);

    expect(screen.getByText("Couldn't load offers")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("garde la toolbar pendant le chargement et en cas d'erreur", () => {
    useInfinitePublicJobsMock.mockReturnValue(
      infiniteResult([], { data: undefined, isLoading: true }),
    );
    const { unmount } = render(<PublicJobsDirectory initialQuery="" />);
    expect(screen.getByRole("combobox", { name: "Work mode" })).toBeInTheDocument();
    unmount();

    useInfinitePublicJobsMock.mockReturnValue(
      infiniteResult([], { isError: true, error: new Error("boom") }),
    );
    render(<PublicJobsDirectory initialQuery="" />);
    expect(screen.getByRole("combobox", { name: "Work mode" })).toBeInTheDocument();
  });
});
