import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfileView } from "@/features/auth/profile";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/lib/api/auth.api";

vi.mock("@/lib/api/auth.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth.api")>();
  return { ...actual, me: vi.fn() };
});

import { me } from "@/lib/api/auth.api";

const mockedMe = vi.mocked(me);

const storeUser: AuthUser = {
  id: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  sex: "female",
  phone: "+1 555 000 0000",
  homeCountry: "FR",
  currentCity: "Paris",
  currentCountry: "FR",
};

function renderProfile() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileView />
    </QueryClientProvider>,
  );
}

describe("ProfileView", () => {
  beforeEach(() => {
    mockedMe.mockReset();
    useAuthStore.getState().clearAuth();
  });

  it("renders the profile fetched from the server", async () => {
    mockedMe.mockResolvedValue({
      ...storeUser,
      currentCity: "Lyon",
    });

    renderProfile();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Lyon")).toBeInTheDocument();
    expect(screen.getAllByText("France")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /change password/i })).toHaveAttribute(
      "href",
      "/change-password",
    );
    expect(mockedMe).toHaveBeenCalledTimes(1);
  });

  it("falls back to the cached session and warns when the server is unreachable", async () => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user: storeUser });
    mockedMe.mockRejectedValue(new Error("network down"));

    renderProfile();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(await screen.findByText("Profile may be out of date")).toBeInTheDocument();
  });

  it("shows a retry state when there is no cached session either", async () => {
    mockedMe.mockRejectedValue(new Error("network down"));

    renderProfile();

    expect(await screen.findByText("Unable to load your profile")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    await waitFor(() => expect(mockedMe).toHaveBeenCalled());
  });
});
