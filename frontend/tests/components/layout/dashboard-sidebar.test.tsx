import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";

describe("DashboardSidebar", () => {
  it("marks Overview as the active destination", () => {
    render(<DashboardSidebar />);

    const overview = screen.getByRole("link", { name: /overview/i });
    expect(overview).toHaveAttribute("href", "/dashboard");
    expect(overview).toHaveAttribute("aria-current", "page");
  });

  it("renders future sections as disabled entries without links", () => {
    render(<DashboardSidebar />);

    const comingSoon = [
      "Offers & Pipelines",
      "Candidate Pool",
      "AI Agents Studio",
      "Interviews & Evaluations",
      "Settings & Integrations",
      "API Help & Documentation",
    ];
    for (const label of comingSoon) {
      const entry = screen.getByText(label);
      expect(entry.closest("a")).toBeNull();
      expect(entry.closest("[aria-disabled='true']")).not.toBeNull();
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
