import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/lib/api/auth.api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

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
};

describe("DashboardHeader", () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user });
  });

  it("keeps backend-less controls inert", () => {
    renderWithQueryClient(<DashboardHeader />);

    expect(
      screen.getByLabelText("Search candidates, jobs, or ask the AI"),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /ai sourcing/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeDisabled();
  });

  it("renders New Job and New Campaign as enabled CTAs", () => {
    renderWithQueryClient(<DashboardHeader />);

    expect(screen.getByRole("button", { name: /new job/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /new campaign/i })).not.toBeDisabled();
  });

  it("shows the signed-in user in the trigger", () => {
    renderWithQueryClient(<DashboardHeader />);

    expect(screen.getByText("Ada L.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
  });
});
