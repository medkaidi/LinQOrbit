import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccountView } from "@/features/auth/account";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/types/auth";

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
  roles: [],
};

function renderAccount() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountView />
    </QueryClientProvider>,
  );
}

describe("AccountView", () => {
  beforeEach(() => {
    mockedMe.mockReset();
    useAuthStore.getState().clearAuth();
  });

  it("renders the account fetched from the server", async () => {
    mockedMe.mockResolvedValue({
      ...storeUser,
      currentCity: "Lyon",
    });

    renderAccount();

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

    renderAccount();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(await screen.findByText("Account may be out of date")).toBeInTheDocument();
  });

  it("shows placeholders when the account has no location data", async () => {
    // Compte créé sans profil (ex. AdminBootstrap) : champs de localisation null.
    mockedMe.mockResolvedValue({
      ...storeUser,
      sex: null,
      phone: null,
      homeCountry: null,
      currentCity: null,
      currentCountry: null,
    });

    renderAccount();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Current city").parentElement).toHaveTextContent("Not provided");
    expect(screen.getByText("Current country").parentElement).toHaveTextContent("Not provided");
    expect(screen.getByText("Country of origin").parentElement).toHaveTextContent("Not provided");
    expect(screen.getByText("Sex").parentElement).toHaveTextContent("Not provided");
    expect(screen.getByText("Phone").parentElement).toHaveTextContent("Not provided");
  });

  it("shows a retry state when there is no cached session either", async () => {
    mockedMe.mockRejectedValue(new Error("network down"));

    renderAccount();

    expect(await screen.findByText("Unable to load your account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    await waitFor(() => expect(mockedMe).toHaveBeenCalled());
  });
});
