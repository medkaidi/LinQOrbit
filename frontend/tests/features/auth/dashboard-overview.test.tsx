import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardOverview } from "@/features/auth/dashboard-overview";
import { listCompanies } from "@/lib/api/company.api";
import { getRecruiter } from "@/lib/api/recruiter.api";
import { useAuthStore } from "@/stores/auth-store";
import { useViewModeStore } from "@/stores/view-mode-store";
import type { AuthUser } from "@/types/auth";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

// La vue candidat a ses propres tests (données réelles) : ici seul son câblage compte.
vi.mock("@/features/candidate/candidate-dashboard", () => ({
  CandidateDashboard: () => <div data-testid="candidate-dashboard" />,
}));

// Idem pour la vue recruteur : seul son câblage compte ici ; l'état du compte (profil, société) est lu en vrai.
vi.mock("@/features/recruiter/recruiter-dashboard", () => ({
  RecruiterDashboard: () => <div data-testid="recruiter-dashboard" />,
}));
vi.mock("@/lib/api/recruiter.api", () => ({ getRecruiter: vi.fn() }));
vi.mock("@/lib/api/company.api", () => ({ listCompanies: vi.fn() }));

const profileMock = vi.mocked(getRecruiter);
const companiesMock = vi.mocked(listCompanies);
const NOT_FOUND = Object.assign(new Error("Not found"), { isAxiosError: true, response: { status: 404 } });

function renderOverview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DashboardOverview />
    </QueryClientProvider>,
  );
}

const user: AuthUser = {
  id: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  sex: "female",
  phone: null,
  homeCountry: "FR",
  currentCity: "Paris",
  currentCountry: "FR",
  roles: [],
};

describe("DashboardOverview", () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user });
    useViewModeStore.setState({ mode: "candidate" });
    profileMock.mockReset();
    companiesMock.mockReset();
    profileMock.mockResolvedValue({ id: "r1", headline: null, bio: null });
    companiesMock.mockResolvedValue([{ id: "c1", name: "Acme", description: null, isOwner: true }]);
  });

  it("greets the signed-in user by first name", () => {
    renderOverview();

    expect(
      screen.getByRole("heading", { level: 1, name: /Welcome back, Ada/ }),
    ).toBeInTheDocument();
  });

  it("shows the real candidate dashboard and none of the recruiter demo content", () => {
    renderOverview();

    expect(screen.getByTestId("candidate-dashboard")).toBeInTheDocument();
    for (const demo of [
      "348",
      "74.2%",
      "Live AI agent control tower",
      "Priority AI recommendations",
      "Predictive hiring audit",
      "Priority open jobs",
      "Showing 4 priority jobs out of 12 total",
    ]) {
      expect(screen.queryByText(demo)).not.toBeInTheDocument();
    }
    expect(screen.queryByText("Staff Software Engineer")).not.toBeInTheDocument();
  });

  it("speaks of the job search and offers to browse offers instead of a campaign", () => {
    renderOverview();

    expect(screen.getByText("Here's where your job search stands.")).toBeInTheDocument();
    expect(screen.queryByText(/recruiting agents/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse offers/i })).toHaveAttribute("href", "/jobs");
    expect(screen.queryByRole("button", { name: /new campaign/i })).not.toBeInTheDocument();
  });

  it("shows the real recruiter dashboard and none of the former demo content in recruiter mode", async () => {
    useViewModeStore.setState({ mode: "recruiter" });

    renderOverview();

    expect(screen.getByTestId("recruiter-dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("candidate-dashboard")).not.toBeInTheDocument();
    for (const demo of [
      "248",
      "86%",
      "16d",
      "Staff Software Engineer",
      "Live AI agent control tower",
      "Priority AI recommendations",
      "Predictive hiring audit",
      "Showing 4 priority jobs out of 12 total",
    ]) {
      expect(screen.queryByText(demo)).not.toBeInTheDocument();
    }
    await waitFor(() => expect(profileMock).toHaveBeenCalled());
  });

  it("greets the recruiter with the same title and the hiring subtitle", async () => {
    useViewModeStore.setState({ mode: "recruiter" });

    renderOverview();

    expect(
      screen.getByRole("heading", { level: 1, name: /Welcome back, Ada/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Here's where your hiring stands.")).toBeInTheDocument();
    expect(screen.queryByText(/recruiting agents/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /browse offers/i })).not.toBeInTheDocument();
    await waitFor(() => expect(profileMock).toHaveBeenCalled());
  });

  it("offers New offer as a real link once the recruiter has a profile and a company", async () => {
    useViewModeStore.setState({ mode: "recruiter" });

    renderOverview();

    expect(await screen.findByRole("link", { name: /new offer/i })).toHaveAttribute(
      "href",
      "/recruiter/offers/new",
    );
    expect(screen.queryByRole("button", { name: /new campaign/i })).not.toBeInTheDocument();
  });

  it("offers no New offer, no campaign and no link without a recruiter profile", async () => {
    useViewModeStore.setState({ mode: "recruiter" });
    profileMock.mockRejectedValue(NOT_FOUND);

    renderOverview();

    await waitFor(() => expect(profileMock).toHaveBeenCalled());
    await waitFor(() => expect(companiesMock).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /new offer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new campaign/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("offers no New offer when the recruiter has no company yet", async () => {
    useViewModeStore.setState({ mode: "recruiter" });
    companiesMock.mockResolvedValue([]);

    renderOverview();

    await waitFor(() => expect(companiesMock).toHaveBeenCalled());
    await waitFor(() => expect(profileMock).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /new offer/i })).not.toBeInTheDocument();
  });

  it("never reads the recruiter account in candidate mode", () => {
    renderOverview();

    expect(profileMock).not.toHaveBeenCalled();
    expect(companiesMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /new offer/i })).not.toBeInTheDocument();
  });
});
