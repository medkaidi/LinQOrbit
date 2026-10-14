import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "@/stores/auth-store";
import { migrateViewModePersisted, useViewModeStore } from "@/stores/view-mode-store";
import type { AuthUser } from "@/types/auth";

function makeUser(id: string): AuthUser {
  return {
    id,
    email: `${id}@example.com`,
    firstName: "Test",
    lastName: "User",
    sex: null,
    phone: null,
    homeCountry: null,
    currentCity: null,
    currentCountry: null,
    roles: [],
  };
}

const alice = makeUser("alice-id");
const bob = makeUser("bob-id");

function signIn(user: AuthUser) {
  useAuthStore.getState().setAuth({ token: "token", user });
}

describe("view-mode-store", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    useViewModeStore.setState({ mode: "candidate", byUser: {} });
  });

  it("defaults to the candidate profile", () => {
    expect(useViewModeStore.getState().mode).toBe("candidate");
  });

  it("switches and persists the selected profile for the logged-in account", () => {
    signIn(alice);

    useViewModeStore.getState().setMode("recruiter");

    expect(useViewModeStore.getState().mode).toBe("recruiter");

    const persisted = JSON.parse(localStorage.getItem("linqorbit.viewMode") ?? "null");
    expect(persisted?.state?.mode).toBe("recruiter");
    expect(persisted?.state?.byUser).toEqual({ "alice-id": "recruiter" });
  });

  it("does not attribute the live mode to any account without a session", () => {
    useViewModeStore.getState().setMode("recruiter");

    expect(useViewModeStore.getState().mode).toBe("recruiter");
    expect(useViewModeStore.getState().byUser).toEqual({});
  });

  it("restores the stored preference for the account signing in", () => {
    signIn(alice);
    useViewModeStore.getState().setMode("recruiter");

    signIn(bob);
    useViewModeStore.getState().restoreForUser(bob.id);
    expect(useViewModeStore.getState().mode).toBe("candidate");

    signIn(alice);
    useViewModeStore.getState().restoreForUser(alice.id);
    expect(useViewModeStore.getState().mode).toBe("recruiter");
  });

  it("isolates preferences between accounts on the same browser", () => {
    signIn(alice);
    useViewModeStore.getState().setMode("recruiter");
    signIn(bob);
    useViewModeStore.getState().setMode("candidate");
    useViewModeStore.getState().restoreForUser(bob.id);
    expect(useViewModeStore.getState().mode).toBe("candidate");

    signIn(alice);
    useViewModeStore.getState().restoreForUser(alice.id);
    expect(useViewModeStore.getState().mode).toBe("recruiter");
  });

  it("falls back to candidate for an unknown account", () => {
    signIn(alice);
    useViewModeStore.getState().setMode("recruiter");

    useViewModeStore.getState().restoreForUser("unknown-id");
    expect(useViewModeStore.getState().mode).toBe("candidate");
  });
});

describe("migrateViewModePersisted (v0 → v1)", () => {
  it("keeps the legacy live mode but drops it from the per-user map", () => {
    expect(migrateViewModePersisted({ mode: "recruiter" })).toEqual({
      mode: "recruiter",
      byUser: {},
    });
  });

  it("defaults to candidate on garbage input", () => {
    expect(migrateViewModePersisted(undefined)).toEqual({ mode: "candidate", byUser: {} });
    expect(migrateViewModePersisted({ mode: "nope" })).toEqual({ mode: "candidate", byUser: {} });
  });
});
