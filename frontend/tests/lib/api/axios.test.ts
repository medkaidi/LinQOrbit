import { beforeEach, describe, expect, it } from "vitest";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api/axios";
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

/** Adaptateur contrôlé : reproduce le settle() des adaptateurs natifs (rejet si statut >= 400). */
function stubAdapter(status: number, data: unknown) {
  return async (config: InternalAxiosRequestConfig) => {
    const response = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) {
      throw new AxiosError(`Request failed with status code ${status}`, String(status), config, null, response);
    }
    return response;
  };
}

describe("api interceptors", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("attaches the bearer token when a session exists", async () => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user });
    let capturedAuthorization: string | undefined;
    api.defaults.adapter = async (config) => {
      capturedAuthorization = config.headers.Authorization as string;
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    };

    await api.get("/api/v1/auth/me");

    expect(capturedAuthorization).toBe("Bearer jwt-token");
  });

  it("sends no authorization header without a session", async () => {
    let capturedAuthorization: string | undefined;
    api.defaults.adapter = async (config) => {
      capturedAuthorization = config.headers.Authorization as string;
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    };

    await api.get("/api/v1/auth/me");

    expect(capturedAuthorization).toBeUndefined();
  });

  it("clears the session when the API answers 401", async () => {
    useAuthStore.getState().setAuth({ token: "expired-token", user });
    api.defaults.adapter = stubAdapter(401, { title: "Unauthorized" });

    await expect(api.get("/api/v1/auth/me")).rejects.toBeTruthy();

    expect(useAuthStore.getState().token).toBeNull();
  });

  it("keeps the session on non-401 errors", async () => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user });
    api.defaults.adapter = stubAdapter(500, { title: "Internal Server Error" });

    await expect(api.get("/api/v1/auth/me")).rejects.toBeTruthy();

    expect(useAuthStore.getState().token).toBe("jwt-token");
  });
});
