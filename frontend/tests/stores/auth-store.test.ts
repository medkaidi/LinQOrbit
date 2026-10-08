import { beforeEach, describe, expect, it } from "vitest";
import { AUTH_STORAGE_KEY, useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/types/auth";

const user: AuthUser = {
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

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    localStorage.removeItem(AUTH_STORAGE_KEY);
  });

  it("starts with no session", () => {
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("stores the session and persists it under linqorbit.auth", () => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user });

    expect(useAuthStore.getState().token).toBe("jwt-token");
    expect(useAuthStore.getState().user?.email).toBe("ada@example.com");

    const persisted = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "null");
    expect(persisted?.state?.token).toBe("jwt-token");
    expect(persisted?.state?.user?.firstName).toBe("Ada");
  });

  it("clears the session from memory and storage", () => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user });

    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    const persisted = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "null");
    expect(persisted?.state?.token).toBeNull();
  });
});
