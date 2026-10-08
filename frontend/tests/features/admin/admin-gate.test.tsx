import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { AdminGate } from "@/features/admin/admin-gate";
import { ROLE } from "@/lib/utils/roles";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/types/auth";

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

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

describe("AdminGate", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    useAuthStore.getState().clearAuth();
  });

  it("renders children for an admin account", async () => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user: adminUser });

    render(
      <AdminGate>
        <div>Admin area</div>
      </AdminGate>,
    );

    expect(await screen.findByText("Admin area")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects to the dashboard for an account without the admin role", async () => {
    useAuthStore.getState().setAuth({
      token: "jwt-token",
      user: { ...adminUser, roles: [] },
    });

    render(
      <AdminGate>
        <div>Admin area</div>
      </AdminGate>,
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByText("Admin area")).not.toBeInTheDocument();
  });

  it("renders nothing and redirects when there is no session", async () => {
    render(
      <AdminGate>
        <div>Admin area</div>
      </AdminGate>,
    );

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByText("Admin area")).not.toBeInTheDocument();
  });
});
