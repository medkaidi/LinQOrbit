import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthGate } from "@/features/auth/auth-gate";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/types/auth";

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
  roles: [],
};

describe("AuthGate", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    useAuthStore.getState().clearAuth();
  });

  it("redirects to login and renders nothing when there is no token", async () => {
    render(
      <AuthGate>
        <div>Secret area</div>
      </AuthGate>,
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Secret area")).not.toBeInTheDocument();
  });

  it("renders children and stays when a token is present", async () => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user });

    render(
      <AuthGate>
        <div>Secret area</div>
      </AuthGate>,
    );

    expect(await screen.findByText("Secret area")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
