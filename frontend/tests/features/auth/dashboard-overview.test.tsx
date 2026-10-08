import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardOverview } from "@/features/auth/dashboard-overview";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/types/auth";

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
  });

  it("greets the signed-in user by first name", () => {
    render(<DashboardOverview />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Welcome back, Ada/ }),
    ).toBeInTheDocument();
  });

  it("shows the demo metrics and the priority pipeline", () => {
    render(<DashboardOverview />);

    expect(screen.getByText("348")).toBeInTheDocument();
    expect(screen.getByText("74.2%")).toBeInTheDocument();
    expect(screen.getAllByText("Staff Software Engineer").length).toBeGreaterThan(0);
    expect(screen.getByText("Showing 4 priority jobs out of 12 total")).toBeInTheDocument();
  });

  it("keeps row action controls inert", () => {
    render(<DashboardOverview />);

    expect(
      screen.getByRole("button", { name: "Row actions for Staff Software Engineer" }),
    ).toBeDisabled();
    expect(screen.queryByRole("link", { name: /view all pipelines/i })).not.toBeInTheDocument();
  });

  it("renders New campaign as an enabled action", () => {
    render(<DashboardOverview />);

    expect(screen.getByRole("button", { name: /new campaign/i })).not.toBeDisabled();
  });
});
