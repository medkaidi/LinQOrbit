import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { ROLE } from "@/lib/utils/roles";
import { useAuthStore } from "@/stores/auth-store";
import { useViewModeStore } from "@/stores/view-mode-store";
import type { AuthUser } from "@/types/auth";

const adminUser: AuthUser = {
  id: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c",
  email: "admin@linqorbit.local",
  firstName: "Platform",
  lastName: "Admin",
  sex: "female",
  phone: null,
  homeCountry: "FR",
  currentCity: "Paris",
  currentCountry: "FR",
  roles: [ROLE.ADMIN],
};

const pathnameMock = vi.hoisted(() => vi.fn(() => "/dashboard"));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

describe("DashboardSidebar", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/dashboard");
    useAuthStore.getState().clearAuth();
    useViewModeStore.setState({ mode: "candidate" });
  });

  afterEach(() => {
    useAuthStore.getState().clearAuth();
    useViewModeStore.setState({ mode: "candidate" });
  });

  it("marks Overview as the active destination", () => {
    render(<DashboardSidebar />);

    const overview = screen.getByRole("link", { name: /overview/i });
    expect(overview).toHaveAttribute("href", "/dashboard");
    expect(overview).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /profile/i })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Profile as the active destination on the profile route", () => {
    pathnameMock.mockReturnValue("/profile");

    render(<DashboardSidebar />);

    const profile = screen.getByRole("link", { name: /profile/i });
    expect(profile).toHaveAttribute("href", "/profile");
    expect(profile).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /overview/i })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps Profile active on the profile editor route", () => {
    pathnameMock.mockReturnValue("/profile/edit");

    render(<DashboardSidebar />);

    const profile = screen.getByRole("link", { name: /profile/i });
    expect(profile).toHaveAttribute("href", "/profile");
    expect(profile).toHaveAttribute("aria-current", "page");
  });

  it("renders future sections as enabled controls without links", () => {
    render(<DashboardSidebar />);

    const futureSections = [
      "Offers & Pipelines",
      "Candidate Pool",
      "AI Agents Studio",
      "Interviews & Evaluations",
      "Settings & Integrations",
      "API Help & Documentation",
    ];
    for (const label of futureSections) {
      const entry = screen.getByText(label);
      expect(entry.closest("a")).toBeNull();
      const control = entry.closest("button");
      expect(control).not.toBeNull();
      expect(control).not.toBeDisabled();
    }
  });

  it("shows the demo AI telemetry card", () => {
    render(<DashboardSidebar />);

    expect(screen.getByText("AI Telemetry")).toBeInTheDocument();
    expect(screen.getByText("98%")).toBeInTheDocument();
    expect(
      screen.getByText("3 agents actively sourcing and ranking in real time."),
    ).toBeInTheDocument();
  });

  it("hides Administration for accounts without the admin role", () => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user: { ...adminUser, roles: [] } });

    render(<DashboardSidebar />);

    expect(screen.queryByRole("link", { name: /administration/i })).not.toBeInTheDocument();
  });

  it("links Administration for admin accounts and marks it active on /admin", () => {
    pathnameMock.mockReturnValue("/admin");
    useAuthStore.getState().setAuth({ token: "jwt-token", user: adminUser });

    render(<DashboardSidebar />);

    const link = screen.getByRole("link", { name: /administration/i });
    expect(link).toHaveAttribute("href", "/admin");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("keeps Administration inactive on other routes", () => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user: adminUser });

    render(<DashboardSidebar />);

    expect(screen.getByRole("link", { name: /administration/i })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  describe("recruiter mode", () => {
    beforeEach(() => {
      useViewModeStore.setState({ mode: "recruiter" });
    });

    it("offers Overview, Offers and Settings as real links on the dashboard", () => {
      render(<DashboardSidebar />);

      const overview = screen.getByRole("link", { name: /overview/i });
      expect(overview).toHaveAttribute("href", "/dashboard");
      expect(overview).toHaveAttribute("aria-current", "page");

      expect(screen.getByRole("link", { name: /offers/i })).toHaveAttribute("href", "/recruiter");
      expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
        "href",
        "/recruiter/settings",
      );
    });

    it("hides the candidate Profile entry and the future placeholder sections", () => {
      render(<DashboardSidebar />);

      expect(screen.queryByRole("link", { name: /^profile$/i })).not.toBeInTheDocument();
      expect(screen.queryByText("Candidate Pool")).not.toBeInTheDocument();
      expect(screen.queryByText("AI Agents Studio")).not.toBeInTheDocument();
    });

    it("marks Offers active on the recruiter workspace and Settings on its route", () => {
      pathnameMock.mockReturnValue("/recruiter/offers/new");
      const { rerender } = render(<DashboardSidebar />);

      expect(screen.getByRole("link", { name: /offers/i })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getByRole("link", { name: /settings/i })).not.toHaveAttribute(
        "aria-current",
        "page",
      );

      pathnameMock.mockReturnValue("/recruiter/settings");
      rerender(<DashboardSidebar />);

      expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getByRole("link", { name: /offers/i })).not.toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    it("keeps the Administration entry for admins", () => {
      useAuthStore.getState().setAuth({ token: "jwt-token", user: adminUser });

      render(<DashboardSidebar />);

      expect(screen.getByRole("link", { name: /administration/i })).toBeInTheDocument();
    });
  });
});
