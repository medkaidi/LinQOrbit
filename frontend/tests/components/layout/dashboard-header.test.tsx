import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/types/auth";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
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
  roles: [],
};

describe("DashboardHeader", () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user });
  });

  it("keeps the notifications control inert", () => {
    renderWithQueryClient(<DashboardHeader />);

    expect(screen.getByRole("button", { name: "Notifications" })).toBeDisabled();
  });

  it("exposes an active Search jobs field", () => {
    renderWithQueryClient(<DashboardHeader />);

    const search = screen.getByLabelText("Search jobs");
    expect(search).not.toBeDisabled();
    expect(search).toHaveAttribute("placeholder", "Search jobs");
  });

  it("renders the profile mode toggle defaulting to Candidate", () => {
    renderWithQueryClient(<DashboardHeader />);

    expect(screen.getByRole("group", { name: "Profile mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Candidate" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Recruiter" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows the signed-in user in the trigger", () => {
    renderWithQueryClient(<DashboardHeader />);

    expect(screen.getByText("Ada L.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
  });
});
