import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useViewMode } from "@/hooks/use-view-mode";
import { useViewModeStore } from "@/stores/view-mode-store";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/dashboard"));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

describe("useViewMode", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/dashboard");
    useViewModeStore.setState({ mode: "candidate" });
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
});
