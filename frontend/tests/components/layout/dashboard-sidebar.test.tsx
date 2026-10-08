import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { ROLE } from "@/lib/utils/roles";
import { useAuthStore } from "@/stores/auth-store";
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
  });

  afterEach(() => {
    useAuthStore.getState().clearAuth();
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
});
