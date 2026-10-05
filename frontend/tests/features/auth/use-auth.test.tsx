import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/use-auth";
import { queryClientWrapper } from "@/tests/helpers/test-utils";
import { useAuthStore } from "@/stores/auth-store";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/api/auth.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth.api")>();
  return { ...actual, signup: vi.fn(), login: vi.fn() };
});

import { login as loginApi, signup as signupApi } from "@/lib/api/auth.api";
import type { AuthResponse } from "@/types/auth";

const mockedLogin = vi.mocked(loginApi);
const mockedSignup = vi.mocked(signupApi);

const authResponse: AuthResponse = {
  token: "jwt-token",
  user: {
    id: "3f0a…",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    sex: "female",
    phone: "+1 555 000 0000",
    homeCountry: "FR",
    currentCity: "Paris",
    currentCountry: "FR",
  },
};

const signupValues = {
  email: "ada@example.com",
  password: "super-secret",
  confirmPassword: "super-secret",
  firstName: "Ada",
  lastName: "Lovelace",
  sex: "female" as const,
  phone: "+1 555 000 0000",
  homeCountry: "FR",
  currentCity: "Paris",
  currentCountry: "FR",
  terms: true,
};

const loginValues = {
  email: "ada@example.com",
  password: "super-secret",
  remember: true,
};

describe("useAuth", () => {
  beforeEach(() => {
    mockedLogin.mockReset();
    mockedSignup.mockReset();
    pushMock.mockClear();
    useAuthStore.getState().clearAuth();
  });

  it("stores the token and redirects after a successful signup", async () => {
    mockedSignup.mockResolvedValue(authResponse);
    const { result } = renderHook(() => useAuth(), { wrapper: queryClientWrapper });

    act(() => result.current.signup(signupValues));

    await waitFor(() => expect(useAuthStore.getState().token).toBe("jwt-token"));
    expect(useAuthStore.getState().user?.email).toBe("ada@example.com");
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("stores the token and redirects after a successful login", async () => {
    mockedLogin.mockResolvedValue(authResponse);
    const { result } = renderHook(() => useAuth(), { wrapper: queryClientWrapper });

    act(() => result.current.login(loginValues));

    await waitFor(() => expect(useAuthStore.getState().token).toBe("jwt-token"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("exposes the server error message when login fails", async () => {
    mockedLogin.mockRejectedValue(
      Object.assign(new Error("unauthorized"), {
        isAxiosError: true,
        response: { data: { detail: "The email or password is incorrect." } },
      }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper: queryClientWrapper });

    act(() => result.current.login(loginValues));

    await waitFor(() =>
      expect(result.current.errorMessage).toBe("The email or password is incorrect."),
    );
    expect(useAuthStore.getState().token).toBeNull();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("exposes the conflict message when signup fails", async () => {
    mockedSignup.mockRejectedValue(
      Object.assign(new Error("conflict"), {
        isAxiosError: true,
        response: { data: { detail: "An account already exists for this email." } },
      }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper: queryClientWrapper });

    act(() => result.current.signup(signupValues));

    await waitFor(() =>
      expect(result.current.errorMessage).toBe("An account already exists for this email."),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("starts idle", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: queryClientWrapper });

    expect(result.current.isPending).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it("clears the session and redirects to login on logout", async () => {
    mockedLogin.mockResolvedValue(authResponse);
    const { result } = renderHook(() => useAuth(), { wrapper: queryClientWrapper });

    act(() => result.current.login(loginValues));
    await waitFor(() => expect(useAuthStore.getState().token).toBe("jwt-token"));
    pushMock.mockClear();

    act(() => result.current.logout());

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
