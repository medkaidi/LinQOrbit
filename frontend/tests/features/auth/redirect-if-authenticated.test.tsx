import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RedirectIfAuthenticated } from "@/features/auth/redirect-if-authenticated";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/lib/api/auth.api";

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
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

describe("RedirectIfAuthenticated", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    useAuthStore.getState().clearAuth();
  });

  it("renders children when there is no session", async () => {
    render(
      <RedirectIfAuthenticated>
        <div>Sign in form</div>
      </RedirectIfAuthenticated>,
    );

    expect(await screen.findByText("Sign in form")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects to the dashboard and hides the form when already authenticated", async () => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user });

    render(
      <RedirectIfAuthenticated>
        <div>Sign in form</div>
      </RedirectIfAuthenticated>,
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByText("Sign in form")).not.toBeInTheDocument();
  });
});
