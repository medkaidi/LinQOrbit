import { beforeEach, describe, expect, it } from "vitest";
import { VIEW_MODE_STORAGE_KEY, useViewModeStore } from "@/stores/view-mode-store";

describe("viewModeStore", () => {
  beforeEach(() => {
    useViewModeStore.setState({ mode: "candidate" });
    localStorage.removeItem(VIEW_MODE_STORAGE_KEY);
  });

  it("starts in candidate mode", () => {
    expect(useViewModeStore.getState().mode).toBe("candidate");
  });

  it("switches mode and persists it under linqorbit.viewMode", () => {
    useViewModeStore.getState().setMode("recruiter");

    expect(useViewModeStore.getState().mode).toBe("recruiter");

    const persisted = JSON.parse(localStorage.getItem(VIEW_MODE_STORAGE_KEY) ?? "null");
    expect(persisted?.state?.mode).toBe("recruiter");
  });
});
