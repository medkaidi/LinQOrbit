import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { PublicJobsView } from "@/features/job-offer/public-jobs-view";
import { useAuthStore } from "@/stores/auth-store";
import { useHeaderSearchStore } from "@/stores/header-search-store";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

const useInfinitePublicJobsMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/jobs",
}));
vi.mock("@/hooks/use-public-jobs", () => ({ useInfinitePublicJobs: useInfinitePublicJobsMock }));
vi.mock("@/hooks/use-job-offers", () => ({
  useWorkModes: () => ({ data: [] }),
  useContractTypes: () => ({ data: [] }),
  useEmploymentTypes: () => ({ data: [] }),
}));

function lastFilters() {
  return useInfinitePublicJobsMock.mock.calls.at(-1)?.[0];
}

/** Header et board montés ensemble : le champ du header pilote réellement la recherche du board. */
function renderBoardWithHeader() {
  return renderWithQueryClient(
    <>
      <DashboardHeader />
      <PublicJobsView />
    </>,
  );
}

describe("job board search lives in the header", () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({
      token: "jwt-token",
      user: {
        id: "u1",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        sex: "female",
        phone: null,
        homeCountry: "FR",
        currentCity: "Paris",
        currentCountry: "FR",
        roles: [],
      },
    });
    useHeaderSearchStore.setState({ role: null, query: "" });
    useInfinitePublicJobsMock.mockReset();
    useInfinitePublicJobsMock.mockReturnValue({
      data: { pages: [{ items: [], page: 0, size: 20, total: 0 }], pageParams: [0] },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    });
  });

  it("shows a single search field, the header one, labelled for the board", () => {
    renderBoardWithHeader();

    const fields = screen.getAllByRole("textbox");
    expect(fields).toHaveLength(1);
    expect(fields[0]).toHaveAccessibleName("Search jobs");
    expect(fields[0]).toHaveAttribute("placeholder", "Search by job title or company");
    expect(screen.queryByRole("textbox", { name: "Search offers" })).not.toBeInTheDocument();
  });

  it("typing in the header filters the board, and Reset empties the header", async () => {
    renderBoardWithHeader();
    const search = screen.getByRole("textbox", { name: "Search jobs" });

    fireEvent.change(search, { target: { value: " rust " } });
    await waitFor(() => expect(lastFilters()).toEqual({ q: "rust" }));

    fireEvent.click((await screen.findAllByRole("button", { name: "Reset" }))[0]);

    await waitFor(() => expect(lastFilters()).toEqual({}));
    expect(search).toHaveValue("");
  });

  it("falls back to the original header field once the board is left", () => {
    const { unmount } = renderWithQueryClient(<PublicJobsView />);
    expect(useHeaderSearchStore.getState().role).not.toBeNull();

    unmount();
    renderWithQueryClient(<DashboardHeader />);

    const search = screen.getByRole("textbox", { name: "Search jobs" });
    expect(search).toHaveAttribute("placeholder", "Search jobs");
    expect(search).not.toHaveAttribute("maxlength");
  });
});
