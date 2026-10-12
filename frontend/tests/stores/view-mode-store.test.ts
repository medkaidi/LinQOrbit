import { beforeEach, describe, expect, it } from "vitest";

import { useViewModeStore } from "@/stores/view-mode-store";

describe("view-mode-store", () => {
  beforeEach(() => {
    useViewModeStore.setState({ mode: "candidate" });
  });

  it("defaults to the candidate profile", () => {
    expect(useViewModeStore.getState().mode).toBe("candidate");
  });

  it("switches and persists the selected profile", () => {
    useViewModeStore.getState().setMode("recruiter");

    expect(useViewModeStore.getState().mode).toBe("recruiter");

    const persisted = JSON.parse(localStorage.getItem("linqorbit.viewMode") ?? "null");
    expect(persisted?.state?.mode).toBe("recruiter");
  });
});
