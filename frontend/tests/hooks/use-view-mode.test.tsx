import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useViewMode } from "@/hooks/use-view-mode";
import { useAuthStore } from "@/stores/auth-store";
import { useViewModeStore } from "@/stores/view-mode-store";
import type { AuthUser } from "@/types/auth";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/dashboard"));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

describe("useViewMode", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/dashboard");
    useAuthStore.getState().clearAuth();
    useViewModeStore.setState({ mode: "candidate", byUser: {} });
  });

  it("keeps the selected profile on non-recruiter routes", () => {
    pathnameMock.mockReturnValue("/dashboard");
    useViewModeStore.setState({ mode: "recruiter" });

    const { result } = renderHook(() => useViewMode());

    expect(result.current.mode).toBe("recruiter");
  });

  it("forces the recruiter profile when entering a recruiter route (deep link)", () => {
    pathnameMock.mockReturnValue("/recruiter/offers/new");

    const { result } = renderHook(() => useViewMode());

    expect(result.current.mode).toBe("recruiter");
  });

  it("does not force the recruiter profile back to candidate", () => {
    pathnameMock.mockReturnValue("/profile");
    useViewModeStore.setState({ mode: "recruiter" });

    const { result } = renderHook(() => useViewMode());

    act(() => result.current.setMode("candidate"));
    expect(result.current.mode).toBe("candidate");
  });

  it("records the mode under the logged-in account when switching", () => {
    const user: AuthUser = {
      id: "user-a",
      email: "a@example.com",
      firstName: "A",
      lastName: "User",
      sex: null,
      phone: null,
      homeCountry: null,
      currentCity: null,
      currentCountry: null,
      roles: [],
    };
    useAuthStore.getState().setAuth({ token: "token", user });

    const { result } = renderHook(() => useViewMode());
    act(() => result.current.setMode("recruiter"));

    expect(useViewModeStore.getState().byUser).toEqual({ "user-a": "recruiter" });

    useAuthStore.getState().clearAuth();
    act(() => result.current.setMode("candidate"));
    expect(useViewModeStore.getState().byUser).toEqual({ "user-a": "recruiter" });
  });

  it("restores the account preference when the login applies it", () => {
    useViewModeStore.setState({ byUser: { "user-a": "recruiter" } });

    useViewModeStore.getState().restoreForUser("user-a");
    expect(renderHook(() => useViewMode()).result.current.mode).toBe("recruiter");

    useViewModeStore.getState().restoreForUser("user-b");
    expect(renderHook(() => useViewMode()).result.current.mode).toBe("candidate");
  });
});
