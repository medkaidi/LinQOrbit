import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/dashboard"));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

describe("DashboardSidebar", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/dashboard");
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
});
