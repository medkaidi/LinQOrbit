import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAccount, useSaveAboutSection } from "@/hooks/use-account";
import { me, updateProfile } from "@/lib/api/auth.api";
import { updateAbout } from "@/lib/api/candidate.api";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/types/auth";
import { queryClientWrapper } from "@/tests/helpers/test-utils";

vi.mock("@/lib/api/auth.api", () => ({ me: vi.fn(), updateProfile: vi.fn() }));
vi.mock("@/lib/api/candidate.api", () => ({ updateAbout: vi.fn() }));

const meMock = vi.mocked(me);
const updateProfileMock = vi.mocked(updateProfile);
const updateAboutMock = vi.mocked(updateAbout);

const user: AuthUser = {
  id: "u1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  sex: null,
  phone: null,
  homeCountry: null,
  currentCity: null,
  currentCountry: null,
  roles: [],
};

describe("useAccount", () => {
  beforeEach(() => {
    meMock.mockReset();
  });

  afterEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("prefers the server account", async () => {
    useAuthStore.getState().setAuth({ token: "t", user: { ...user, firstName: "Stale" } });
    meMock.mockResolvedValue(user);

    const { result } = renderHook(() => useAccount(), { wrapper: queryClientWrapper });

    await waitFor(() => expect(result.current.account?.firstName).toBe("Ada"));
  });

  it("falls back to the session account while the server has not answered", () => {
    useAuthStore.getState().setAuth({ token: "t", user });
    meMock.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAccount(), { wrapper: queryClientWrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.account).toEqual(user);
  });

  it("returns null without server data nor session", () => {
    meMock.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAccount(), { wrapper: queryClientWrapper });

    expect(result.current.account).toBeNull();
  });
});

describe("useSaveAboutSection", () => {
  const values = {
    firstName: "Ada",
    lastName: "Lovelace",
    title: "Engineer",
    bio: "Bio",
    yearsOfExperience: 5,
    searchStatus: null,
  } as never;

  beforeEach(() => {
    updateProfileMock.mockReset();
    updateAboutMock.mockReset();
  });

  it("splits account and About fields between the two endpoints", async () => {
    updateProfileMock.mockResolvedValue(user);
    updateAboutMock.mockResolvedValue({} as never);

    const { result } = renderHook(() => useSaveAboutSection(), { wrapper: queryClientWrapper });
    await result.current.mutateAsync(values);

    expect(updateProfileMock).toHaveBeenCalledWith({ firstName: "Ada", lastName: "Lovelace" });
    expect(updateAboutMock).toHaveBeenCalledWith({
      title: "Engineer",
      bio: "Bio",
      yearsOfExperience: 5,
      searchStatus: null,
    });
  });

  it("fails when either request fails, after both were sent", async () => {
    const failure = new Error("about failed");
    updateProfileMock.mockResolvedValue(user);
    updateAboutMock.mockRejectedValue(failure);

    const { result } = renderHook(() => useSaveAboutSection(), { wrapper: queryClientWrapper });

    await expect(result.current.mutateAsync(values)).rejects.toBe(failure);
    expect(updateProfileMock).toHaveBeenCalledTimes(1);
  });
});
